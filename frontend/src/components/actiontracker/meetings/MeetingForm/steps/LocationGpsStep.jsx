// frontend/src/components/actiontracker/meetings/MeetingForm/steps/LocationGpsStep.jsx

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Stack,
  Chip,
  IconButton,
  InputAdornment,
  CircularProgress,
  Collapse,
  Switch,
  Alert,
  Breadcrumbs,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Search as SearchIcon,
  MyLocation as MyLocationIcon,
  GpsFixed as GpsFixedIcon,
  GpsNotFixed as GpsNotFixedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ChevronRight as ChevronRightIcon,
  ArrowForward as ArrowForwardIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon,
  EventSeat as EventSeatIcon,
  Apartment as ApartmentIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import api from '../../../../../services/api';

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

const getLevelInfo = (location) => {
  if (!location) return null;
  if (location?.location_mode === 'buildings') {
    return BUILDING_LEVELS.find(l => l.level === location.level);
  }
  return ADDRESS_LEVELS.find(l => l.level === location.level);
};

const alphaHelper = (color, opacity) => {
  if (!color) return 'rgba(0,0,0,0.1)';
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

// Location Tree Node Component with lazy loading
const LocationTreeNode = memo(({ 
  node, 
  depth, 
  onSelect, 
  onToggle, 
  expandedNodes, 
  selectedId 
}) => {
  const theme = useTheme();
  const [children, setChildren] = useState(node.children || []);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedChildren, setHasLoadedChildren] = useState(false);
  
  const levelInfo = getLevelInfo(node);
  const hasChildren = node.has_children || (node.children && node.children.length > 0);
  const isSelected = selectedId === node.id;
  const isExpandedNode = expandedNodes[node.id] || false;

  // Load children on demand
  const loadChildren = async () => {
    if (hasLoadedChildren || isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await api.get(`/locations/tree/children/${node.id}`);
      const childData = response.data || [];
      setChildren(childData);
      setHasLoadedChildren(true);
      
      // Auto-expand if there are children
      if (childData.length > 0) {
        onToggle(node.id);
      }
    } catch (error) {
      console.error('Error loading children:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    // First, select the location
    onSelect(node);
    
    // Then, if it has children and they're not loaded yet, load them
    if (hasChildren && !hasLoadedChildren) {
      loadChildren();
    }
    
    // Toggle expansion
    onToggle(node.id);
  };

  return (
    <Box sx={{ ml: depth * 2 }}>
      <ListItemButton
        onClick={handleClick}
        sx={{ 
          borderRadius: 1, 
          mb: 0.5, 
          py: 0.5,
          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.06),
          },
          borderLeft: isSelected ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
          transition: 'all 0.2s ease',
        }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          {isLoading ? (
            <CircularProgress size={16} />
          ) : hasChildren ? (
            isExpandedNode ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />
          ) : (
            levelInfo?.icon || <LocationIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText
          primary={
            <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap">
              <Typography 
                variant="body2" 
                fontWeight={isSelected ? 600 : 400}
                color={isSelected ? 'primary.main' : 'text.primary'}
              >
                {node.name || 'Unnamed'}
              </Typography>
              {node.code && (
                <Typography variant="caption" color="text.secondary">({node.code})</Typography>
              )}
              {levelInfo && (
                <Chip 
                  label={levelInfo.name} 
                  size="small" 
                  sx={{ 
                    height: 16, 
                    fontSize: '0.5rem',
                    bgcolor: alphaHelper(levelInfo.color, 0.1),
                    color: levelInfo.color,
                    '& .MuiChip-label': { px: 0.5 }
                  }} 
                />
              )}
              {node.child_count > 0 && !hasLoadedChildren && (
                <Chip 
                  label={`${node.child_count} children`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 16, fontSize: '0.5rem' }}
                />
              )}
              {isSelected && (
                <Chip 
                  label="Selected"
                  size="small"
                  color="primary"
                  icon={<CheckIcon sx={{ fontSize: 12 }} />}
                  sx={{ height: 16, fontSize: '0.5rem' }}
                />
              )}
            </Stack>
          }
        />
      </ListItemButton>
      
      {/* Children */}
      {isExpandedNode && children.length > 0 && (
        <Box sx={{ ml: 1 }}>
          {children.map(child => (
            <LocationTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              onToggle={onToggle}
              expandedNodes={expandedNodes}
              selectedId={selectedId}
            />
          ))}
        </Box>
      )}
      
      {/* Loading indicator for children */}
      {isExpandedNode && isLoading && (
        <Box sx={{ ml: 2, p: 1 }}>
          <CircularProgress size={16} />
        </Box>
      )}
    </Box>
  );
});

LocationTreeNode.displayName = 'LocationTreeNode';

export const LocationGpsStep = memo(({
  formData,
  setFormData,
  handleLocationSelect,
  gpsEnabled,
  setGpsEnabled,
  isMobile,
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locationMode, setLocationMode] = useState('address');
  const [selectedLocation, setSelectedLocation] = useState(formData.location_details || null);
  const [locationHierarchy, setLocationHierarchy] = useState([]);
  const [rootNodes, setRootNodes] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSupported, setGpsSupported] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);
  const [error, setError] = useState(null);

  // Check GPS support
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsSupported(false);
    }
  }, []);

  // Load location hierarchy when selected location changes
  useEffect(() => {
    if (selectedLocation?.id) {
      loadLocationHierarchy(selectedLocation.id);
    } else {
      setLocationHierarchy([]);
    }
  }, [selectedLocation]);

  // Load roots on mount and mode change
  useEffect(() => {
    loadRoots();
  }, [locationMode]);

  const loadRoots = async () => {
    setLoadingTree(true);
    setError(null);
    try {
      console.log(`🔄 Loading root nodes for mode: ${locationMode}`);
      
      const response = await api.get('/locations/tree/roots', {
        params: { location_mode: locationMode }
      });
      
      console.log('📡 Root nodes response:', response.data);
      
      if (Array.isArray(response.data)) {
        setRootNodes(response.data);
        console.log(`✅ Loaded ${response.data.length} root nodes`);
      } else {
        console.warn('⚠️ Unexpected data format:', response.data);
        setRootNodes([]);
      }
      
    } catch (err) {
      console.error('❌ Error loading root nodes:', err);
      setError(err.message || 'Failed to load locations');
      setRootNodes([]);
    } finally {
      setLoadingTree(false);
    }
  };

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
      let data = response.data;
      if (Array.isArray(data)) {
        setSearchResults(data);
      } else if (data?.items) {
        setSearchResults(data.items);
      } else if (data?.data) {
        setSearchResults(data.data);
      } else {
        setSearchResults([]);
      }
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
    handleLocationSelect(location);
    
    // Auto-expand to show children if any
    if (location.has_children) {
      setExpandedNodes(prev => ({
        ...prev,
        [location.id]: true
      }));
    }
  };

  const handleClearLocation = () => {
    setSelectedLocation(null);
    setLocationHierarchy([]);
    handleLocationSelect(null);
  };

  const handleToggleNode = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const getCurrentLocation = useCallback(() => {
    if (!gpsSupported) {
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          gps_latitude: position.coords.latitude.toFixed(6),
          gps_longitude: position.coords.longitude.toFixed(6)
        }));
        setGpsEnabled(true);
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [gpsSupported, setFormData, setGpsEnabled]);

  const handleGpsToggle = (event) => {
    const enabled = event.target.checked;
    setGpsEnabled(enabled);
    if (!enabled) {
      setFormData(prev => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
    } else if (gpsSupported && !formData.gps_latitude) {
      getCurrentLocation();
    }
  };

  // Show loading state
  if (loadingTree) {
    return (
      <Box sx={{ width: '100%', p: 2 }}>
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Stack spacing={2} alignItems="center">
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary">
                Loading locations...
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Show error state
  if (error) {
    return (
      <Box sx={{ width: '100%', p: 2 }}>
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Stack spacing={2} alignItems="center">
              <Alert severity="error" sx={{ width: '100%' }}>
                {error}
              </Alert>
              <Button 
                variant="outlined" 
                startIcon={<RefreshIcon />} 
                onClick={loadRoots}
              >
                Retry
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Stack spacing={2}>
        {/* Location Search */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <LocationIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Meeting Location
                  </Typography>
                  <Chip 
                    label={`${rootNodes.length} root locations`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.6rem' } }}
                  />
                </Stack>
                <Stack direction="row" spacing={0.5}>
                  <IconButton size="small" onClick={loadRoots} title="Refresh locations">
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                  {selectedLocation && (
                    <Chip
                      label={selectedLocation.name || 'Location Selected'}
                      size="small"
                      color="success"
                      onDelete={handleClearLocation}
                      sx={{ height: 24, '& .MuiChip-label': { fontSize: '0.7rem' } }}
                    />
                  )}
                </Stack>
              </Stack>

              <ToggleButtonGroup
                value={locationMode}
                exclusive
                onChange={(e, val) => val && setLocationMode(val)}
                size="small"
                fullWidth
                sx={{ height: 32 }}
              >
                <ToggleButton value="address" sx={{ fontSize: '0.75rem' }}>
                  <PublicIcon sx={{ mr: 0.5, fontSize: 16 }} /> Addresses
                </ToggleButton>
                <ToggleButton value="buildings" sx={{ fontSize: '0.75rem' }}>
                  <ApartmentIcon sx={{ mr: 0.5, fontSize: 16 }} /> Buildings
                </ToggleButton>
              </ToggleButtonGroup>

              <TextField
                fullWidth
                placeholder={`Search ${locationMode === 'address' ? 'address' : 'building'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                    endAdornment: loading && <CircularProgress size={16} />
                  }
                }}
              />

              {searchResults.length > 0 && (
                <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                  <List dense disablePadding>
                    {searchResults.map(result => {
                      const levelInfo = getLevelInfo(result);
                      const isSelected = selectedLocation?.id === result.id;
                      return (
                        <ListItemButton
                          key={result.id}
                          onClick={() => handleSelectLocation(result)}
                          selected={isSelected}
                          sx={{ 
                            py: 0.5,
                            bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.04),
                            }
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {levelInfo?.icon || <LocationIcon fontSize="small" />}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                                  {result.name || 'Unnamed'}
                                </Typography>
                                {isSelected && (
                                  <Chip 
                                    label="Selected" 
                                    size="small" 
                                    color="primary" 
                                    icon={<CheckIcon sx={{ fontSize: 12 }} />}
                                    sx={{ height: 16, fontSize: '0.5rem' }}
                                  />
                                )}
                              </Stack>
                            }
                            secondary={`${result.code || ''} ${levelInfo?.name ? `• ${levelInfo.name}` : ''}`}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Paper>
              )}

              {!searchTerm && rootNodes.length === 0 && (
                <Alert severity="info" icon={<InfoIcon />} sx={{ py: 0 }}>
                  <Typography variant="caption">
                    No locations available. Click the refresh button to reload or contact your administrator.
                  </Typography>
                </Alert>
              )}

              {!searchTerm && rootNodes.length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary">
                    Click a location to select it — children will load automatically:
                  </Typography>
                  <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                    <List dense disablePadding>
                      {rootNodes.map(node => (
                        <LocationTreeNode
                          key={node.id}
                          node={node}
                          depth={0}
                          onSelect={handleSelectLocation}
                          onToggle={handleToggleNode}
                          expandedNodes={expandedNodes}
                          selectedId={selectedLocation?.id}
                        />
                      ))}
                    </List>
                  </Paper>
                </>
              )}

              {selectedLocation && locationHierarchy.length > 0 && (
                <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Selected Location Path:</Typography>
                  <Breadcrumbs separator={<ArrowForwardIcon sx={{ fontSize: 12 }} />} sx={{ flexWrap: 'wrap' }}>
                    {locationHierarchy.map((item) => {
                      const levelInfo = getLevelInfo(item);
                      return (
                        <Chip
                          key={item.id}
                          label={item.name || 'Unnamed'}
                          size="small"
                          icon={levelInfo?.icon}
                          sx={{
                            height: 20,
                            '& .MuiChip-label': { fontSize: '0.65rem' },
                            bgcolor: alphaHelper(levelInfo?.color || theme.palette.primary.main, 0.1),
                            borderColor: levelInfo?.color,
                            color: levelInfo?.color,
                          }}
                        />
                      );
                    })}
                  </Breadcrumbs>
                </Paper>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* GPS Toggle */}
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={gpsEnabled}
                onChange={handleGpsToggle}
                disabled={!gpsSupported || gpsLoading}
                size="small"
              />
              <Stack direction="row" alignItems="center" spacing={1}>
                <GpsFixedIcon sx={{ fontSize: 18, color: gpsEnabled ? 'success.main' : 'text.disabled' }} />
                <Typography variant="body2">
                  Add GPS Coordinates
                  {!gpsSupported && <span style={{ color: theme.palette.error.main, marginLeft: 4 }}>(Not supported)</span>}
                </Typography>
              </Stack>
              {gpsLoading && <CircularProgress size={16} />}
              {gpsSupported && !gpsLoading && (
                <IconButton size="small" onClick={getCurrentLocation} disabled={gpsLoading}>
                  <MyLocationIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>

            <Collapse in={gpsEnabled}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr' }, gap: 1.5 }}>
                <TextField
                  label="Latitude"
                  name="gps_latitude"
                  value={formData.gps_latitude || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, gps_latitude: e.target.value }))}
                  size="small"
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start"><GpsFixedIcon fontSize="small" /></InputAdornment>,
                    }
                  }}
                />
                <TextField
                  label="Longitude"
                  name="gps_longitude"
                  value={formData.gps_longitude || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, gps_longitude: e.target.value }))}
                  size="small"
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start"><GpsNotFixedIcon fontSize="small" /></InputAdornment>,
                    }
                  }}
                />
              </Box>
            </Collapse>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
});

LocationGpsStep.displayName = 'LocationGpsStep';

export default LocationGpsStep;