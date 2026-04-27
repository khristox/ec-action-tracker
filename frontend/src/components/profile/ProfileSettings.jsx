import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Grid, Avatar, Alert,
  CircularProgress, Divider, IconButton, Snackbar, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress,
  useTheme, useMediaQuery, Fade, Tooltip, alpha, InputAdornment,
  MenuItem, FormControl, InputLabel, Select, Card, CardContent,
  Breadcrumbs, List, ListItemButton, ListItemIcon, ListItemText,
  ToggleButton, ToggleButtonGroup, Tab, Tabs
} from '@mui/material';
import {
  PhotoCamera, Edit, PersonOutline, EmailOutlined, PhoneOutlined,
  DeleteOutline, CheckCircleOutline, Close, SaveOutlined, LocationOn,
  WorkOutline, School, Description, Language, AccessTime, CalendarToday,
  Badge, Phone, Home, Business, Flag, AttachMoney, Search as SearchIcon,
  Public as PublicIcon, Apartment as ApartmentIcon, ChevronRight as ChevronRightIcon,
  Flag as FlagIcon, Terrain as TerrainIcon, MeetingRoom as MeetingRoomIcon,
  EventSeat as EventSeatIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
  LocationCity as LocationCityIcon, DomainOutlined as StructureIcon,
  AccountTree as BrowseIcon, Search as SearchTabIcon, Lock as LockIcon,
  Business as BusinessIcon, Home as HomeIcon, CameraAlt as CameraIcon,
  FlipCameraAndroid as FlipCameraIcon, Stop as StopIcon, Photo as PhotoIcon,RefreshOutlined
} from '@mui/icons-material';

import { useDispatch, useSelector } from 'react-redux';
import { 
  updateUserProfile, 
  uploadProfilePicture, 
  deleteProfilePicture,
  selectIsUploading,
  selectIsDeleting,
  fetchProfilePicture,
  selectProfilePicture
} from '../../store/slices/authSlice';
import { format } from 'date-fns';
import api from '../../services/api';

import CameraDialog from './CameraDialog'

// Constants
const ADDRESS_LEVELS = [
  { level: 1, name: 'Country', icon: <PublicIcon />, color: '#4CAF50' },
  { level: 2, name: 'Region', icon: <FlagIcon />, color: '#2196F3' },
  { level: 3, name: 'District', icon: <TerrainIcon />, color: '#9C27B0' },
  { level: 4, name: 'County', icon: <BusinessIcon />, color: '#FF9800' },
  { level: 5, name: 'Subcounty', icon: <HomeIcon />, color: '#795548' },
  { level: 6, name: 'Parish', icon: <LocationOn />, color: '#607D8B' },
  { level: 7, name: 'Village', icon: <HomeIcon />, color: '#8BC34A' },
];

const BUILDING_LEVELS = [
  { level: 11, name: 'Office', icon: <ApartmentIcon />, color: '#E91E63' },
  { level: 12, name: 'Building', icon: <BusinessIcon />, color: '#3F51B5' },
  { level: 13, name: 'Room', icon: <MeetingRoomIcon />, color: '#009688' },
  { level: 14, name: 'Conference', icon: <EventSeatIcon />, color: '#673AB7' },
];

// Helper functions
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

// Image compression
const compressImage = (file, maxSize = 400) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = ({ target }) => {
    const img = new Image();
    img.src = target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(img.width, img.height, maxSize);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const offsetX = (img.width - size) / 2;
      const offsetY = (img.height - size) / 2;
      ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);
      canvas.toBlob(blob => {
        resolve(new File([blob], 'profile.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.8);
    };
    img.onerror = reject;
  };
  reader.onerror = reject;
});

// Fetch attribute options helper
const fetchAttributeOptions = async (group) => {
  try {
    const res = await api.get(`/attribute-groups/${group}/attributes`, {
      params: { active_only: true, sort_by: 'sort_order', sort_order: 'asc', limit: 100 }
    });
    const items = res.data?.items || res.data || [];
    return items.map(item => ({
      id: item.id,
      label: item.name?.replace(`${group} - `, '') || item.short_name || item.name,
      value: item.short_name,
      sort_order: item.sort_order
    })).sort((a, b) => a.sort_order - b.sort_order);
  } catch (error) {
    console.error(`Failed to fetch ${group}:`, error);
    return [];
  }
};

// HierarchyNode component
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
          skip: 0,
          limit: 100,
          location_mode: locationMode,
          parent_id: node.id,
          include_inactive: false,
        });
        const response = await api.get(`/locations/?${params.toString()}`);
        const items = response.data?.items || response.data || [];
        setChildren(items);
      } catch (err) {
        console.error('Error loading children:', err);
      } finally {
        setLoadingChildren(false);
        setChildrenLoaded(true);
      }
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
        {mightHaveChildren ? (
          <IconButton size="small" onClick={handleToggle} sx={{ mr: 0.5, p: 0.25, color: 'text.secondary' }}>
            {loadingChildren ? <CircularProgress size={14} /> : open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        ) : (
          <Box sx={{ width: 28 }} />
        )}
        <Box sx={{ color: levelInfo?.color || 'text.secondary', display: 'flex', mr: 1, fontSize: 18 }}>
          {levelInfo?.icon || <LocationOn fontSize="small" />}
        </Box>
        <ListItemText 
          primary={node.name}
          secondary={`${node.code} · ${levelInfo?.name || `Level ${node.level}`}`}
          primaryTypographyProps={{ variant: 'body2' }}
          secondaryTypographyProps={{ variant: 'caption' }}
        />
        {isSelected && <Chip label="Selected" size="small" color="success" sx={{ ml: 1, fontWeight: 600 }} />}
      </ListItemButton>
      {open && childrenLoaded && (
        <Box>
          {children.length === 0 ? (
            <Box sx={{ pl: 1 + (depth + 1) * 2 + 3.5, py: 0.5 }}>
              <Typography variant="caption" color="text.disabled">No sub-items</Typography>
            </Box>
          ) : (
            children.map(child => (
              <HierarchyNode
                key={child.id}
                node={child}
                depth={depth + 1}
                locationMode={locationMode}
                onSelect={onSelect}
                selectedId={selectedId}
              />
            ))
          )}
        </Box>
      )}
    </Box>
  );
});

// LocationSearch Component
const LocationSearch = React.memo(({ value, onChange, onClear }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
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

  useEffect(() => {
    setRootsLoaded({ address: false, structure: false });
    setAddressRoots([]);
    setStructureRoots([]);
  }, [locationMode]);

  useEffect(() => {
    if (value !== selectedLocation) setSelectedLocation(value);
  }, [value]);

  useEffect(() => {
    if (selectedLocation?.id) loadLocationHierarchy(selectedLocation.id);
    else setLocationHierarchy([]);
  }, [selectedLocation?.id]);

  useEffect(() => {
    if (activeTab !== 0) return;
    const apiMode = locationMode === 'structure' ? 'buildings' : 'address';
    const alreadyLoaded = rootsLoaded[locationMode];
    if (alreadyLoaded) return;
    
    const loadRoots = async () => {
      setRootsLoading(true);
      try {
        const params = new URLSearchParams({ 
          skip: 0, 
          limit: 100, 
          location_mode: apiMode, 
          include_inactive: false,
          sort_by: 'name',
          sort_order: 'asc'
        });
        const response = await api.get(`/locations/?${params.toString()}`);
        const items = response.data?.items || response.data || [];
        if (locationMode === 'address') {
          setAddressRoots(items);
        } else {
          setStructureRoots(items);
        }
        setRootsLoaded(prev => ({ ...prev, [locationMode]: true }));
      } catch (err) {
        console.error('Error loading roots:', err);
      } finally {
        setRootsLoading(false);
      }
    };
    loadRoots();
  }, [locationMode, activeTab, rootsLoaded]);

  useEffect(() => {
    if (activeTab !== 1) return;
    if (!searchTerm || searchTerm.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const apiMode = locationMode === 'structure' ? 'buildings' : 'address';
        const params = new URLSearchParams({ 
          search: searchTerm, 
          location_mode: apiMode, 
          limit: 50, 
          include_inactive: false,
          sort_by: 'name',
          sort_order: 'asc'
        });
        const response = await api.get(`/locations/?${params.toString()}`);
        setSearchResults(response.data?.items || response.data || []);
      } catch (err) {
        console.error('Error searching locations:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [searchTerm, locationMode, activeTab]);

  const loadLocationHierarchy = async (locationId) => {
    try {
      const res = await api.get(`/locations/${locationId}/ancestors`);
      const ancestors = res.data || [];
      const selfRes = await api.get(`/locations/${locationId}`);
      setLocationHierarchy(selfRes.data ? [...ancestors, selfRes.data] : ancestors);
    } catch {
      setLocationHierarchy(selectedLocation ? [selectedLocation] : []);
    }
  };

  const handleSelect = (location) => {
    setSelectedLocation(location);
    setSearchTerm('');
    setSearchResults([]);
    onChange(location);
  };

  const handleClear = () => {
    setSelectedLocation(null);
    setLocationHierarchy([]);
    onChange(null);
    if (onClear) onClear();
  };

  const currentRoots = locationMode === 'address' ? addressRoots : structureRoots;
  const apiModeLabel = locationMode === 'address' ? 'address (Country, District, Village…)' : 'structure (Office, Building, Room…)';

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }} spacing={1}>
            <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
              <LocationOn sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>Location (CTE)</Typography>
            </Stack>
            {selectedLocation && <Chip label="Location Selected" size="small" color="success" onDelete={handleClear} deleteIcon={<Close />} />}
          </Stack>
          
          <ToggleButtonGroup value={locationMode} exclusive onChange={(_, val) => { if (val) { setLocationMode(val); setSearchTerm(''); setSearchResults([]); } }} size="small" fullWidth>
            <ToggleButton value="address"><PublicIcon sx={{ mr: 0.75, fontSize: 18 }} /> Address</ToggleButton>
            <ToggleButton value="structure"><StructureIcon sx={{ mr: 0.75, fontSize: 18 }} /> Structure</ToggleButton>
          </ToggleButtonGroup>
          
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} variant="fullWidth" sx={{ minHeight: 36 }}>
            <Tab icon={<BrowseIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Browse" sx={{ minHeight: 36, py: 0.5 }} />
            <Tab icon={<SearchTabIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Search" sx={{ minHeight: 36, py: 0.5 }} />
          </Tabs>
          
          {activeTab === 0 && (
            <>
              <Typography variant="caption" color="text.secondary">
                <BrowseIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} /> Click to select location, use arrow to expand:
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 380, overflow: 'auto', borderRadius: 1.5, p: 0.5 }}>
                {rootsLoading ? (
                  <Stack sx={{ alignItems: 'center', p: 3 }}><CircularProgress size={30} /><Typography variant="caption" sx={{ mt: 1 }}>Loading...</Typography></Stack>
                ) : currentRoots.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.disabled">No items found</Typography></Box>
                ) : (
                  <List dense disablePadding>
                    {currentRoots.map(node => (
                      <HierarchyNode 
                        key={node.id} 
                        node={node} 
                        depth={0} 
                        locationMode={locationMode === 'structure' ? 'buildings' : 'address'} 
                        onSelect={handleSelect} 
                        selectedId={selectedLocation?.id} 
                      />
                    ))}
                  </List>
                )}
              </Paper>
            </>
          )}
          
          {activeTab === 1 && (
            <>
              <TextField
                fullWidth placeholder={`Search ${apiModeLabel}…`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} size="small" autoFocus
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>, endAdornment: searchLoading && <CircularProgress size={18} /> } }}
              />
              {!searchTerm && <Alert severity="info" variant="outlined">Enter at least 2 characters to search</Alert>}
              {searchTerm && searchTerm.length < 2 && <Alert severity="warning" variant="outlined">Please enter at least 2 characters</Alert>}
              {searchResults.length > 0 && (
                <Paper variant="outlined" sx={{ maxHeight: 380, overflow: 'auto', borderRadius: 1.5 }}>
                  <List dense disablePadding>
                    {searchResults.map(result => {
                      const li = getLevelInfo(result);
                      return (
                        <ListItemButton key={result.id} onClick={() => handleSelect(result)} selected={selectedLocation?.id === result.id} sx={{ py: 0.75 }}>
                          <ListItemIcon sx={{ minWidth: 32, color: li?.color }}>{li?.icon || <LocationOn fontSize="small" />}</ListItemIcon>
                          <ListItemText primary={result.name} secondary={`${result.code} · ${li?.name || `Level ${result.level}`}`} />
                          {selectedLocation?.id === result.id && <CheckCircleOutline fontSize="small" color="success" />}
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Paper>
              )}
              {searchTerm && searchTerm.length >= 2 && !searchLoading && searchResults.length === 0 && (
                <Alert severity="info" variant="outlined">No locations found matching "{searchTerm}"</Alert>
              )}
            </>
          )}
          
          {selectedLocation && locationHierarchy.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Selected path:</Typography>
              <Breadcrumbs separator={<ChevronRightIcon sx={{ fontSize: 14 }} />} sx={{ flexWrap: 'wrap' }}>
                {locationHierarchy.map(item => {
                  const li = getLevelInfo(item);
                  return <Chip key={item.id} label={item.name} size="small" icon={li?.icon} sx={{ bgcolor: hexAlpha(li?.color || theme.palette.primary.main, 0.1), borderColor: li?.color || theme.palette.primary.main, color: li?.color || theme.palette.primary.main, border: '1px solid', fontWeight: 500 }} />;
                })}
              </Breadcrumbs>
            </Paper>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
});

// Address Hierarchy Display Component
const AddressHierarchyDisplay = ({ location }) => {
  const [hierarchy, setHierarchy] = useState([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const loadHierarchy = async () => {
      if (!location?.id) {
        setHierarchy([]);
        setLoading(false);
        return;
      }

      try {
        const [locationRes, ancestorsRes] = await Promise.all([
          api.get(`/locations/${location.id}`),
          api.get(`/locations/${location.id}/ancestors`)
        ]);
        
        const currentLocation = locationRes.data;
        const ancestors = ancestorsRes.data || [];
        setHierarchy([...ancestors, currentLocation]);
      } catch (err) {
        console.error('Error loading address hierarchy:', err);
        setHierarchy(location ? [location] : []);
      } finally {
        setLoading(false);
      }
    };

    loadHierarchy();
  }, [location?.id]);

  if (loading) {
    return <CircularProgress size={20} />;
  }

  if (hierarchy.length === 0) {
    return <Typography variant="body2" color="text.secondary">No address selected</Typography>;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="caption" fontWeight={600} color="text.secondary">Address Hierarchy:</Typography>
      <Breadcrumbs separator={<ChevronRightIcon sx={{ fontSize: 14 }} />} sx={{ flexWrap: 'wrap' }}>
        {hierarchy.map((item, idx) => {
          const levelInfo = getLevelInfo(item);
          const isLast = idx === hierarchy.length - 1;
          return (
            <Chip
              key={item.id}
              label={item.name}
              size="small"
              icon={levelInfo?.icon}
              sx={{
                bgcolor: hexAlpha(levelInfo?.color || theme.palette.primary.main, 0.1),
                borderColor: levelInfo?.color || theme.palette.primary.main,
                color: levelInfo?.color || theme.palette.primary.main,
                border: '1px solid',
                fontWeight: isLast ? 700 : 500,
              }}
            />
          );
        })}
      </Breadcrumbs>
    </Stack>
  );
};

// Camera Dialog Component
// Camera Dialog Component - Fixed for stable video


// Main ProfileSettings Component
const ProfileSettings = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, isLoading } = useSelector((state) => state.auth);
  const profilePicture = useSelector(selectProfilePicture);
  const isUploading = useSelector(selectIsUploading);
  const isDeleting = useSelector(selectIsDeleting);

  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [genderOptions, setGenderOptions] = useState([]);
  const [languageOptions, setLanguageOptions] = useState([]);
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [countryOptions, setCountryOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [formData, setFormData] = useState({
    phone: '',
    date_of_birth: '',
    gender_attribute_id: '',
    location_id: '',
    location_details: null,
    language_attribute_id: '',
    currency_attribute_id: ''
  });

  // Fetch profile picture on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      dispatch(fetchProfilePicture());
    }
  }, [dispatch, user?.id]);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      const [genders, languages, currencies, countries] = await Promise.all([
        fetchAttributeOptions('GENDER'),
        fetchAttributeOptions('LANGUAGE'),
        fetchAttributeOptions('CURRENCY'),
        fetchAttributeOptions('COUNTRY')
      ]);
      setGenderOptions(genders);
      setLanguageOptions(languages);
      setCurrencyOptions(currencies);
      setCountryOptions(countries);
      setLoadingOptions(false);
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        phone: user.phone || '',
        date_of_birth: user.date_of_birth ? format(new Date(user.date_of_birth), 'yyyy-MM-dd') : '',
        gender_attribute_id: user.gender_attribute_id || '',
        location_id: user.location_id || '',
        location_details: user.location_id ? { 
          id: user.location_id, 
          name: user.location_name || user.address,
          code: user.location_code,
          level: user.location_level,
          location_mode: user.location_mode
        } : null,
        language_attribute_id: user.language_attribute_id || '',
        currency_attribute_id: user.currency_attribute_id || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLocationSelect = useCallback((location) => {
    if (location) {
      setFormData(prev => ({ 
        ...prev, 
        location_id: location.id, 
        location_details: { 
          id: location.id, 
          name: location.name, 
          code: location.code, 
          level: location.level, 
          location_mode: location.location_mode 
        }
      }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        location_id: '', 
        location_details: null
      }));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    
    const changed = {};
    
    const updatableFields = [
      'phone', 'date_of_birth', 'gender_attribute_id', 'location_id',
      'language_attribute_id', 'currency_attribute_id'
    ];
    
    updatableFields.forEach(key => {
      const originalValue = user?.[key] || '';
      const currentValue = formData[key];
      
      if (currentValue !== originalValue && currentValue !== undefined) {
        if (currentValue !== '' || originalValue !== '') {
          changed[key] = currentValue === '' ? null : currentValue;
        }
      }
    });
    
    if (formData.location_id !== (user?.location_id || '')) {
      changed.location_id = formData.location_id || null;
    }
    
    if (Object.keys(changed).length === 0) {
      setSnackbar({ open: true, message: 'No changes to save', severity: 'info' });
      setIsUpdating(false);
      return;
    }
    
    try {
      await dispatch(updateUserProfile(changed)).unwrap();
      setSnackbar({ open: true, message: 'Profile updated successfully!', severity: 'success' });
      setIsEditing(false);
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Update failed', severity: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setSnackbar({ open: true, message: 'Please select a valid image (JPEG, PNG, GIF, WEBP)', severity: 'error' });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setSnackbar({ open: true, message: 'Image must be less than 5MB', severity: 'error' });
      return;
    }
    
    try {
      const compressed = await compressImage(file);
      setSelectedFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setUploadDialogOpen(true);
    } catch {
      setSnackbar({ open: true, message: 'Image processing failed', severity: 'error' });
    }
  };

  const handleCameraCapture = async (file) => {
    try {
      const compressed = await compressImage(file);
      setSelectedFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setUploadDialogOpen(true);
    } catch {
      setSnackbar({ open: true, message: 'Image processing failed', severity: 'error' });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await dispatch(uploadProfilePicture(selectedFile)).unwrap();
      await dispatch(fetchProfilePicture());
      setSnackbar({ open: true, message: 'Profile photo updated!', severity: 'success' });
      setUploadDialogOpen(false);
      setPreviewUrl(null);
      setSelectedFile(null);
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Upload failed', severity: 'error' });
    }
  };

  const handleDeletePicture = async () => {
    try {
      await dispatch(deleteProfilePicture()).unwrap();
      await dispatch(fetchProfilePicture());
      setSnackbar({ open: true, message: 'Profile photo removed', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Delete failed', severity: 'error' });
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        phone: user.phone || '',
        date_of_birth: user.date_of_birth ? format(new Date(user.date_of_birth), 'yyyy-MM-dd') : '',
        gender_attribute_id: user.gender_attribute_id || '',
        location_id: user.location_id || '',
        location_details: user.location_id ? { id: user.location_id, name: user.location_name } : null,
        language_attribute_id: user.language_attribute_id || '',
        currency_attribute_id: user.currency_attribute_id || ''
      });
    }
    setIsEditing(false);
  };

  const closeUploadDialog = () => {
    setUploadDialogOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setSelectedFile(null);
  };

  if (isLoading || loadingOptions) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const avatarUrl = profilePicture || user?.avatar_url || null;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1000, mx: 'auto' }}>
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ height: 4, background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})` }} />
        
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight={700}>Profile Settings</Typography>
            {!isEditing && (
              <Button variant="outlined" onClick={() => setIsEditing(true)} startIcon={<Edit />} size="small" sx={{ borderRadius: 2 }}>
                Edit Profile
              </Button>
            )}
          </Stack>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Avatar Section */}
              <Grid size={12}>
                <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: 'center' }} spacing={2}>
                  <Box sx={{ position: 'relative' }}>
                    <Avatar src={avatarUrl} sx={{ width: 100, height: 100, bgcolor: 'primary.main', fontSize: 40, border: '3px solid', borderColor: 'background.paper', boxShadow: theme.shadows[2] }}>
                      {user?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </Avatar>
                    <Tooltip title="Change photo">
                      <IconButton 
                        component="label" 
                        size="small" 
                        disabled={isUploading} 
                        sx={{ position: 'absolute', bottom: 0, right: 0, bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, width: 32, height: 32 }}
                      >
                        <input hidden accept="image/*" type="file" onChange={handleFileSelect} />
                        {isUploading ? <CircularProgress size={16} color="inherit" /> : <PhotoCamera sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Take photo with camera">
                      <IconButton 
                        size="small" 
                        onClick={() => setCameraDialogOpen(true)} 
                        disabled={isUploading}
                        sx={{ position: 'absolute', bottom: 0, right: -32, bgcolor: 'secondary.main', color: 'white', '&:hover': { bgcolor: 'secondary.dark' }, width: 32, height: 32 }}
                      >
                        <CameraIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    {avatarUrl && !isDeleting && (
                      <Tooltip title="Remove photo">
                        <IconButton 
                          size="small" 
                          onClick={handleDeletePicture} 
                          disabled={isDeleting}
                          sx={{ position: 'absolute', bottom: 0, left: 0, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' }, width: 32, height: 32 }}
                        >
                          {isDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutline sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                    <Typography variant="h6" fontWeight={600}>
                      {user?.first_name} {user?.last_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
                    <Chip icon={<LockIcon />} label="Name cannot be edited" size="small" variant="outlined" sx={{ mt: 1 }} />
                  </Box>
                </Stack>
              </Grid>

              <Grid size={12}><Divider /></Grid>

              {/* Contact Information */}
              <Grid size={12}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Contact Information</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField 
                  fullWidth label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} disabled={!isEditing} size="small" placeholder="+1234567890"
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><PhoneOutlined fontSize="small" /></InputAdornment> } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField 
                  fullWidth label="Date of Birth" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleChange} disabled={!isEditing} size="small"
                  slotProps={{ inputLabel: { shrink: true }, input: { startAdornment: <InputAdornment position="start"><CalendarToday fontSize="small" /></InputAdornment> } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small" disabled={!isEditing}>
                  <InputLabel>Gender</InputLabel>
                  <Select name="gender_attribute_id" value={formData.gender_attribute_id} onChange={handleChange} label="Gender">
                    <MenuItem value=""><em>None</em></MenuItem>
                    {genderOptions.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              {/* Location Section with CTE */}
              <Grid size={12}><Divider sx={{ my: 1 }} /></Grid>
              <Grid size={12}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  <LocationOn fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} /> Address Location
                </Typography>
              </Grid>
              
              {isEditing ? (
                <Grid size={12}>
                  <LocationSearch 
                    value={formData.location_details} 
                    onChange={handleLocationSelect} 
                    onClear={() => handleLocationSelect(null)} 
                  />
                </Grid>
              ) : (
                formData.location_details && (
                  <Grid size={12}>
                    <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: 'background.default' }}>
                      <CardContent>
                        <AddressHierarchyDisplay location={formData.location_details} />
                      </CardContent>
                    </Card>
                  </Grid>
                )
              )}

              {/* Preferences */}
              <Grid size={12}><Divider sx={{ my: 1 }} /></Grid>
              <Grid size={12}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  <Language fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} /> Preferences
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small" disabled={!isEditing}>
                  <InputLabel>Language</InputLabel>
                  <Select name="language_attribute_id" value={formData.language_attribute_id} onChange={handleChange} label="Language">
                    <MenuItem value=""><em>None</em></MenuItem>
                    {languageOptions.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small" disabled={!isEditing}>
                  <InputLabel>Currency</InputLabel>
                  <Select name="currency_attribute_id" value={formData.currency_attribute_id} onChange={handleChange} label="Currency">
                    <MenuItem value=""><em>None</em></MenuItem>
                    {currencyOptions.map(opt => <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              {/* Action Buttons */}
              {isEditing && (
                <Grid size={12}>
                  <Stack direction="row" sx={{ justifyContent: 'flex-end' }} spacing={2} sx={{ mt: 2 }}>
                    <Button variant="outlined" onClick={handleCancel} disabled={isUpdating} sx={{ borderRadius: 2 }}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={isUpdating} sx={{ borderRadius: 2, minWidth: 120 }}>
                      {isUpdating ? <CircularProgress size={20} /> : 'Save Changes'}
                    </Button>
                  </Stack>
                </Grid>
              )}
            </Grid>
          </form>

          {/* Status & Roles */}
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>Account Status</Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap' }} spacing={1}>
            <Chip size="small" label={user?.is_verified ? 'Verified' : 'Unverified'} color={user?.is_verified ? 'success' : 'warning'} variant="outlined" />
            <Chip size="small" label={user?.is_active ? 'Active' : 'Inactive'} color={user?.is_active ? 'success' : 'error'} variant="outlined" />
            {user?.roles?.map((role, i) => <Chip key={i} size="small" label={role} variant="outlined" />)}
          </Stack>
        </Box>
      </Paper>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={closeUploadDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography fontWeight={600}>Preview Photo</Typography>
            <IconButton size="small" onClick={closeUploadDialog} disabled={isUploading}><Close fontSize="small" /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          <Avatar src={previewUrl} sx={{ width: 200, height: 200, mx: 'auto', mb: 2 }} />
          <Typography variant="body2" color="text.secondary">This will be your new profile photo</Typography>
          {isUploading && <LinearProgress sx={{ mt: 2, borderRadius: 2 }} />}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={closeUploadDialog} disabled={isUploading} fullWidth={isMobile}>Cancel</Button>
          <Button onClick={handleUpload} variant="contained" disabled={isUploading} fullWidth={isMobile}>
            {isUploading ? <CircularProgress size={20} /> : 'Set as Photo'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Camera Dialog */}
      <CameraDialog 
        open={cameraDialogOpen} 
        onClose={() => setCameraDialogOpen(false)} 
        onCapture={handleCameraCapture} 
      />

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProfileSettings;