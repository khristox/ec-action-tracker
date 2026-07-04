// src/components/actiontracker/meetings/components/LocationSearch.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, TextField, InputAdornment,
  Paper, List, ListItemButton, ListItemIcon, ListItemText, Chip,
  CircularProgress, Alert, Breadcrumbs, IconButton, ToggleButton, ToggleButtonGroup,
  Skeleton, Collapse
} from '@mui/material';
import {
  Search as SearchIcon,
  LocationOn as LocationIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ChevronRight as ChevronRightIcon,
  CheckCircle as CheckCircleIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  Apartment as ApartmentIcon,
  MeetingRoom as MeetingRoomIcon,
  EventSeat as EventSeatIcon,
  DomainOutlined as StructureIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

// Address Levels
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

const hexAlpha = (color, opacity) => {
  if (!color) return `rgba(0,0,0,${opacity})`;
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

// Hierarchy Node Component
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
          limit: 50,
          location_mode: locationMode,
          parent_id: node.id,
          include_inactive: false,
        });
        const response = await api.get(`/locations/?${params.toString()}`);
        const items = response.data?.items || response.data || [];
        setChildren(items);
        setChildrenLoaded(true);
      } catch (err) {
        console.error('Error loading children:', err);
      } finally {
        setLoadingChildren(false);
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
        {mightHaveChildren && (
          <IconButton size="small" onClick={handleToggle} sx={{ mr: 0.5, p: 0.25, color: 'text.secondary' }}>
            {loadingChildren ? <CircularProgress size={14} /> : open ? <ExpandLessIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        )}
        <Box sx={{ color: levelInfo?.color || 'text.secondary', display: 'flex', mr: 1, fontSize: 18 }}>
          {levelInfo?.icon || <LocationIcon fontSize="small" />}
        </Box>
        <ListItemText
          primary={<Typography variant="body2" fontWeight={isSelected ? 700 : 400} noWrap>{node.name}</Typography>}
          secondary={<Typography variant="caption" color="text.disabled" noWrap>{node.code} · {levelInfo?.name || `Level ${node.level}`}</Typography>}
        />
        {isSelected && <CheckCircleIcon fontSize="small" color="success" sx={{ ml: 1 }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ ml: 2 }}>
          {children.map(child => (
            <HierarchyNode key={child.id} node={child} depth={depth + 1} locationMode={locationMode} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
});

// Main LocationSearch Component
export const LocationSearch = React.memo(({ value, onChange, onClear, error, helperText }) => {
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

  useEffect(() => {
    if (value !== selectedLocation) setSelectedLocation(value);
  }, [value]);

  useEffect(() => {
    if (selectedLocation?.id) {
      loadLocationHierarchy(selectedLocation.id);
    } else {
      setLocationHierarchy([]);
    }
  }, [selectedLocation?.id]);

  useEffect(() => {
    const apiMode = locationMode === 'structure' ? 'buildings' : 'address';
    if (rootsLoaded[locationMode]) return;
    
    const loadRoots = async () => {
      setRootsLoading(true);
      try {
        const params = new URLSearchParams({
          skip: 0,
          limit: 100,
          location_mode: apiMode,
          include_inactive: false
        });
        const response = await api.get(`/locations/?${params.toString()}`);
        const items = response.data?.items || response.data || [];
        if (locationMode === 'address') setAddressRoots(items);
        else setStructureRoots(items);
        setRootsLoaded(prev => ({ ...prev, [locationMode]: true }));
      } catch (err) {
        console.error('Error loading roots:', err);
      } finally {
        setRootsLoading(false);
      }
    };
    loadRoots();
  }, [locationMode, rootsLoaded]);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const apiMode = locationMode === 'structure' ? 'buildings' : 'address';
        const params = new URLSearchParams({
          search: searchTerm,
          location_mode: apiMode,
          limit: 50,
          include_inactive: false
        });
        const response = await api.get(`/locations/?${params.toString()}`);
        const results = response.data?.items || response.data || [];
        setSearchResults(results);
      } catch (err) {
        console.error('Error searching locations:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 450);
    
    return () => clearTimeout(timer);
  }, [searchTerm, locationMode]);

  const loadLocationHierarchy = async (locationId) => {
    try {
      const res = await api.get(`/locations/${locationId}/ancestors`);
      const ancestors = res.data || [];
      const selfRes = await api.get(`/locations/${locationId}`);
      const location = selfRes.data?.data || selfRes.data;
      setLocationHierarchy(location ? [...ancestors, location] : ancestors);
    } catch (err) {
      console.error('Error loading hierarchy:', err);
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
  const apiMode = locationMode === 'structure' ? 'buildings' : 'address';

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: error ? 'error.main' : 'divider' }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <LocationIcon sx={{ color: error ? 'error.main' : 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>Meeting Location</Typography>
            </Stack>
            {selectedLocation && (
              <Chip 
                label="Location Selected" 
                size="small" 
                color="success" 
                onDelete={handleClear}
                deleteIcon={<Close />}
              />
            )}
          </Stack>

          <ToggleButtonGroup 
            value={locationMode} 
            exclusive 
            onChange={(_, val) => { if (val) { setLocationMode(val); setSearchTerm(''); setSearchResults([]); } }} 
            size="small" 
            fullWidth
          >
            <ToggleButton value="address"><PublicIcon sx={{ mr: 0.75, fontSize: 18 }} /> Address</ToggleButton>
            <ToggleButton value="structure"><StructureIcon sx={{ mr: 0.75, fontSize: 18 }} /> Structure</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            fullWidth
            placeholder="Search location..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            size="small"
            error={error && !selectedLocation}
            helperText={error && !selectedLocation ? helperText : ''}
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
                    <ListItemButton 
                      key={result.id} 
                      onClick={() => handleSelect(result)} 
                      selected={selectedLocation?.id === result.id} 
                      sx={{ py: 0.75 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, color: li?.color }}>
                        {li?.icon || <LocationIcon fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary={result.name} 
                        secondary={`${result.code} · ${li?.name || `Level ${result.level}`}`} 
                      />
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
                  <Stack spacing={1} sx={{ p: 1.5 }}>
                    {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={36} />)}
                  </Stack>
                ) : currentRoots.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.disabled">No items found</Typography>
                  </Box>
                ) : (
                  <List dense disablePadding>
                    {currentRoots.map(node => (
                      <HierarchyNode 
                        key={node.id} 
                        node={node} 
                        depth={0} 
                        locationMode={apiMode} 
                        onSelect={handleSelect} 
                        selectedId={selectedLocation?.id} 
                      />
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
                    <Chip 
                      key={item.id} 
                      label={item.name} 
                      size="small" 
                      icon={li?.icon}
                      sx={{ 
                        bgcolor: hexAlpha(li?.color || theme.palette.primary.main, 0.1), 
                        borderColor: li?.color || theme.palette.primary.main, 
                        color: li?.color || theme.palette.primary.main, 
                        border: '1px solid', 
                        fontWeight: 500 
                      }} 
                    />
                  );
                })}
              </Breadcrumbs>
            </Paper>
          )}

          {!selectedLocation && !searchTerm && (
            <Alert severity="info" variant="outlined" sx={{ borderRadius: 1.5 }}>
              Search or browse to pick a location. You can select either an address or a structure.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
});

export default LocationSearch;