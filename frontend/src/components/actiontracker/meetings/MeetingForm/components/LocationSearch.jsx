// src/components/meetings/MeetingForm/components/LocationSearch.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Box,
  Alert,
  Chip,
  Breadcrumbs,
  IconButton,
  Skeleton,
  Button,
  Collapse,
  Tooltip,
  Fade,
  Zoom
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Search as SearchIcon,
  Public as PublicIcon,
  DomainOutlined as StructureIcon,
  CheckCircle as CheckCircleIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  GpsFixed as GpsFixedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
  Star as StarIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon,
  EventSeat as EventSeatIcon,
  Apartment as ApartmentIcon
} from '@mui/icons-material';
import api from '../../../../../services/api';
import { getLevelInfo, hexAlpha } from '../utils';
import { ADDRESS_LEVELS, BUILDING_LEVELS } from '../constants';

// Icon mapping - converts string names to actual components
const ICON_COMPONENTS = {
  PublicIcon: PublicIcon,
  FlagIcon: FlagIcon,
  TerrainIcon: TerrainIcon,
  BusinessIcon: BusinessIcon,
  HomeIcon: HomeIcon,
  LocationIcon: LocationIcon,
  ApartmentIcon: ApartmentIcon,
  MeetingRoomIcon: MeetingRoomIcon,
  EventSeatIcon: EventSeatIcon,
  StructureIcon: StructureIcon,
};

const renderIcon = (iconName, props = { fontSize: 'small' }) => {
  const Icon = ICON_COMPONENTS[iconName];
  if (!Icon) return <LocationIcon {...props} />;
  return <Icon {...props} />;
};

// Custom hook for debounced values
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
};

// Hierarchy Node Component
const HierarchyNode = React.memo(({ 
  node, 
  depth, 
  locationMode, 
  onSelect, 
  selectedId,
  expandedNodes,
  onToggleExpand,
  recentlyUsed = false
}) => {
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const levelInfo = getLevelInfo(node, ADDRESS_LEVELS, BUILDING_LEVELS);
  const isSelected = selectedId === node.id;
  const isExpanded = expandedNodes[node.id] || false;
  const maxLevel = locationMode === 'buildings' ? 14 : 7;
  const mightHaveChildren = node.level < maxLevel;

  const handleToggle = useCallback(async (e) => {
    e.stopPropagation();
    const newExpandedState = !isExpanded;
    onToggleExpand(node.id, newExpandedState);
    
    if (newExpandedState && !childrenLoaded && mightHaveChildren) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      setLoadingChildren(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          skip: 0,
          limit: 100,
          location_mode: locationMode,
          include_inactive: false,
        });
        
        if (node.id) {
          params.append('parent_id', node.id);
        }
        
        const response = await api.get(`/locations/?${params.toString()}`, {
          signal: abortControllerRef.current.signal
        });
        
        const items = response.data?.items || response.data || [];
        setChildren(items);
        setChildrenLoaded(true);
      } catch (err) {
        if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
          console.error('Error loading children:', err);
          setError(err.response?.data?.message || 'Failed to load child locations');
        }
      } finally {
        setLoadingChildren(false);
      }
    }
  }, [node.id, node.level, locationMode, childrenLoaded, isExpanded, onToggleExpand, mightHaveChildren]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
          transition: 'all 0.2s ease',
          '&.Mui-selected': {
            bgcolor: hexAlpha(levelInfo?.color || '#1976d2', 0.12),
            '&:hover': {
              bgcolor: hexAlpha(levelInfo?.color || '#1976d2', 0.18)
            }
          },
          '&:hover': {
            bgcolor: 'action.hover',
            transform: 'translateX(2px)'
          }
        }}
      >
        {mightHaveChildren && (
          <IconButton
            size="small"
            onClick={handleToggle}
            sx={{ mr: 0.5, p: 0.25 }}
            disabled={loadingChildren}
          >
            {loadingChildren ? (
              <CircularProgress size={14} />
            ) : isExpanded ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </IconButton>
        )}
        <Box sx={{ color: levelInfo?.color || 'text.secondary', display: 'flex', mr: 1, fontSize: 18 }}>
          {renderIcon(levelInfo?.icon, { fontSize: 'small' })}
        </Box>
        <ListItemText
          primary={
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="body2" fontWeight={isSelected ? 700 : 400} noWrap>
                {node.name}
              </Typography>
              {recentlyUsed && (
                <Tooltip title="Recently used">
                  <StarIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                </Tooltip>
              )}
            </Stack>
          }
          secondary={
            <Typography variant="caption" color="text.disabled" noWrap>
              {node.code} · {levelInfo?.name || `Level ${node.level}`}
            </Typography>
          }
        />
        {isSelected && (
          <Zoom in={isSelected}>
            <Chip 
              label="Selected" 
              size="small" 
              color="success" 
              sx={{ ml: 1, fontWeight: 600 }} 
            />
          </Zoom>
        )}
      </ListItemButton>
      
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ ml: 2, borderLeft: 1, borderColor: 'divider', pl: 1 }}>
          {error && (
            <Alert severity="error" size="small" sx={{ m: 1 }}>
              {error}
              <Button size="small" onClick={() => {
                setError(null);
                setChildrenLoaded(false);
              }}>
                Retry
              </Button>
            </Alert>
          )}
          {children.map(child => (
            <HierarchyNode
              key={child.id}
              node={child}
              depth={depth + 1}
              locationMode={locationMode}
              onSelect={onSelect}
              selectedId={selectedId}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
            />
          ))}
          {childrenLoaded && children.length === 0 && !error && (
            <Typography variant="caption" color="text.disabled" sx={{ pl: 4, py: 1, display: 'block' }}>
              No child locations
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
});

HierarchyNode.displayName = 'HierarchyNode';

// Recent Locations Component
const RecentLocations = ({ locations, onSelect, selectedId }) => {
  if (!locations || locations.length === 0) return null;
  
  return (
    <Paper variant="outlined" sx={{ mb: 2, p: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <HistoryIcon fontSize="small" color="action" />
        <Typography variant="caption" fontWeight={600}>Recently Used</Typography>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {locations.map(loc => {
          const levelInfo = getLevelInfo(loc, ADDRESS_LEVELS, BUILDING_LEVELS);
          return (
            <Chip
              key={loc.id}
              label={loc.name}
              size="small"
              onClick={() => onSelect(loc)}
              variant={selectedId === loc.id ? 'filled' : 'outlined'}
              color={selectedId === loc.id ? 'primary' : 'default'}
              icon={renderIcon(levelInfo?.icon, { fontSize: 'small' })}
            />
          );
        })}
      </Stack>
    </Paper>
  );
};

// Main LocationSearch Component
export const LocationSearch = React.memo(({ value, onChange, onClear }) => {
  const [locationMode, setLocationMode] = useState('address');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addressRoots, setAddressRoots] = useState([]);
  const [structureRoots, setStructureRoots] = useState([]);
  const [rootsLoading, setRootsLoading] = useState(false);
  const [rootsError, setRootsError] = useState(null);
  const [rootsLoaded, setRootsLoaded] = useState({ address: false, structure: false });
  const [selectedLocation, setSelectedLocation] = useState(value || null);
  const [locationHierarchy, setLocationHierarchy] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [hierarchyError, setHierarchyError] = useState(null);
  const [recentLocations, setRecentLocations] = useState([]);
  
  const abortControllerRef = useRef(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Load recent locations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentLocations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRecentLocations(parsed.slice(0, 5));
      } catch (e) {
        console.error('Failed to parse recent locations:', e);
      }
    }
  }, []);

  // Save selected location to recent
  const saveToRecent = useCallback((location) => {
    setRecentLocations(prev => {
      const filtered = prev.filter(l => l.id !== location.id);
      const updated = [location, ...filtered].slice(0, 5);
      localStorage.setItem('recentLocations', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Update selected location when value prop changes
  useEffect(() => {
    if (value !== selectedLocation) {
      setSelectedLocation(value);
      if (value?.id) {
        loadLocationHierarchy(value.id);
      }
    }
  }, [value]);

  // Load location hierarchy when a location is selected
  useEffect(() => {
    if (selectedLocation?.id) {
      loadLocationHierarchy(selectedLocation.id);
    } else {
      setLocationHierarchy([]);
      setHierarchyError(null);
    }
  }, [selectedLocation?.id]);

  // Load root locations based on mode
  useEffect(() => {
    const apiMode = locationMode === 'structure' ? 'buildings' : 'address';
    
    if (rootsLoaded[locationMode]) return;
    
    const loadRoots = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      setRootsLoading(true);
      setRootsError(null);
      
      try {
        const params = new URLSearchParams({
          skip: 0,
          limit: 100,
          location_mode: apiMode,
          include_inactive: false
        });
        
        const response = await api.get(`/locations/?${params.toString()}`, {
          signal: abortControllerRef.current.signal
        });
        
        const items = response.data?.items || response.data || [];
        
        if (locationMode === 'address') {
          setAddressRoots(items);
        } else {
          setStructureRoots(items);
        }
        
        setRootsLoaded(prev => ({ ...prev, [locationMode]: true }));
      } catch (err) {
        if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
          console.error('Error loading roots:', err);
          setRootsError(err.response?.data?.message || 'Failed to load locations');
        }
      } finally {
        setRootsLoading(false);
      }
    };
    
    loadRoots();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [locationMode, rootsLoaded]);

  // Search locations with debounce
  useEffect(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const performSearch = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      setSearchLoading(true);
      try {
        const apiMode = locationMode === 'structure' ? 'buildings' : 'address';
        const params = new URLSearchParams({
          search: debouncedSearchTerm,
          location_mode: apiMode,
          limit: 50,
          include_inactive: false
        });
        
        const response = await api.get(`/locations/?${params.toString()}`, {
          signal: abortControllerRef.current.signal
        });
        
        const results = response.data?.items || response.data || [];
        setSearchResults(results);
      } catch (err) {
        if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
          console.error('Error searching locations:', err);
          setSearchResults([]);
        }
      } finally {
        setSearchLoading(false);
      }
    };
    
    performSearch();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedSearchTerm, locationMode]);

  const loadLocationHierarchy = async (locationId) => {
    if (!locationId) return;
    
    setLoadingHierarchy(true);
    setHierarchyError(null);
    
    try {
      const [ancestorsResponse, currentResponse] = await Promise.all([
        api.get(`/locations/${locationId}/ancestors`),
        api.get(`/locations/${locationId}`)
      ]);
      
      const ancestors = ancestorsResponse.data || [];
      const currentLocation = currentResponse.data;
      
      setLocationHierarchy(currentLocation ? [...ancestors, currentLocation] : ancestors);
    } catch (error) {
      console.error('Error loading hierarchy:', error);
      setHierarchyError(error.response?.data?.message || 'Failed to load location hierarchy');
      if (selectedLocation) {
        setLocationHierarchy([selectedLocation]);
      }
    } finally {
      setLoadingHierarchy(false);
    }
  };

  const handleSelect = useCallback((location) => {
    setSelectedLocation(location);
    setSearchTerm('');
    setSearchResults([]);
    setHierarchyError(null);
    saveToRecent(location);
    onChange(location);
  }, [onChange, saveToRecent]);

  const handleClear = useCallback(() => {
    setSelectedLocation(null);
    setLocationHierarchy([]);
    setExpandedNodes({});
    setHierarchyError(null);
    onChange(null);
    if (onClear) onClear();
  }, [onChange, onClear]);

  const handleToggleExpand = useCallback((nodeId, isExpanded) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: isExpanded
    }));
  }, []);

  const handleRefresh = useCallback(() => {
    setRootsLoaded(prev => ({ ...prev, [locationMode]: false }));
    setRootsError(null);
  }, [locationMode]);

  const currentRoots = locationMode === 'address' ? addressRoots : structureRoots;
  const apiMode = locationMode === 'structure' ? 'buildings' : 'address';

  const recentLocationsComponent = useMemo(() => (
    <RecentLocations 
      locations={recentLocations} 
      onSelect={handleSelect}
      selectedId={selectedLocation?.id}
    />
  ), [recentLocations, handleSelect, selectedLocation?.id]);

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Stack direction="row" alignItems="center" spacing={1}>
              <LocationIcon sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Meeting Location
              </Typography>
            </Stack>
            {selectedLocation && (
              <Tooltip title="Clear selection">
                <Chip
                  label="Location Selected"
                  size="small"
                  color="success"
                  onDelete={handleClear}
                  deleteIcon={<CloseIcon />}
                />
              </Tooltip>
            )}
          </Stack>

          {/* Mode Toggle */}
          <ToggleButtonGroup
            value={locationMode}
            exclusive
            onChange={(_, val) => {
              if (val) {
                setLocationMode(val);
                setSearchTerm('');
                setSearchResults([]);
                setExpandedNodes({});
                setRootsError(null);
              }
            }}
            size="small"
            fullWidth
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

          {/* Recent Locations */}
          {!searchTerm && !selectedLocation && recentLocationsComponent}

          {/* Search Input */}
          <TextField
            fullWidth
            placeholder="Search location by name or code..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchLoading && (
                  <InputAdornment position="end">
                    <CircularProgress size={18} />
                  </InputAdornment>
                )
              }
            }}
          />

          {/* Search Results */}
          {searchResults.length > 0 && (
            <Fade in={searchResults.length > 0}>
              <Paper variant="outlined" sx={{ maxHeight: 280, overflow: 'auto', borderRadius: 1.5 }}>
                <List dense disablePadding>
                  {searchResults.map(result => {
                    const levelInfo = getLevelInfo(result, ADDRESS_LEVELS, BUILDING_LEVELS);
                    return (
                      <ListItemButton
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        selected={selectedLocation?.id === result.id}
                        sx={{ py: 0.75 }}
                      >
                        <ListItemIcon sx={{ minWidth: 32, color: levelInfo?.color }}>
                          {renderIcon(levelInfo?.icon, { fontSize: 'small' })}
                        </ListItemIcon>
                        <ListItemText
                          primary={result.name}
                          secondary={`${result.code} · ${levelInfo?.name || `Level ${result.level}`}`}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        {selectedLocation?.id === result.id && (
                          <CheckCircleIcon fontSize="small" color="success" />
                        )}
                      </ListItemButton>
                    );
                  })}
                </List>
              </Paper>
            </Fade>
          )}

          {/* Hierarchy Browser */}
          {!searchTerm && (
            <>
              <Typography variant="caption" color="text.secondary">
                Or browse the hierarchy:
              </Typography>
              
              <Paper variant="outlined" sx={{ maxHeight: 380, overflow: 'auto', borderRadius: 1.5, p: 0.5 }}>
                {rootsLoading ? (
                  <Stack spacing={1} sx={{ p: 1.5 }}>
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} variant="rounded" height={36} animation="wave" />
                    ))}
                  </Stack>
                ) : rootsError ? (
                  <Alert 
                    severity="error" 
                    icon={<ErrorIcon />} 
                    action={
                      <Button color="inherit" size="small" onClick={handleRefresh} startIcon={<RefreshIcon />}>
                        Retry
                      </Button>
                    }
                    sx={{ m: 1 }}
                  >
                    {rootsError}
                  </Alert>
                ) : currentRoots.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.disabled">
                      No locations found
                    </Typography>
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
                        expandedNodes={expandedNodes}
                        onToggleExpand={handleToggleExpand}
                        recentlyUsed={recentLocations.some(l => l.id === node.id)}
                      />
                    ))}
                  </List>
                )}
              </Paper>
            </>
          )}

          {/* Selected Location Path */}
          {selectedLocation && (
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Selected path:
              </Typography>
              {loadingHierarchy ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} />
                  <Typography variant="caption">Loading hierarchy...</Typography>
                </Stack>
              ) : hierarchyError ? (
                <Alert severity="warning" size="small">
                  {hierarchyError}
                </Alert>
              ) : locationHierarchy.length > 0 ? (
                <Breadcrumbs
                  separator={<ChevronRightIcon sx={{ fontSize: 14 }} />}
                  maxItems={3}
                  itemsBeforeCollapse={2}
                  itemsAfterCollapse={2}
                >
                  {locationHierarchy.map((item) => {
                    const levelInfo = getLevelInfo(item, ADDRESS_LEVELS, BUILDING_LEVELS);
                    return (
                      <Tooltip key={item.id} title={`${levelInfo?.name || 'Location'} · ${item.code}`}>
                        <Chip
                          label={item.name}
                          size="small"
                          icon={renderIcon(levelInfo?.icon, { fontSize: 'small' })}
                          sx={{
                            bgcolor: levelInfo ? hexAlpha(levelInfo.color, 0.1) : hexAlpha('#1976d2', 0.1),
                            borderColor: levelInfo?.color || '#1976d2',
                            color: levelInfo?.color || '#1976d2',
                            border: '1px solid',
                            fontWeight: 500,
                            '& .MuiChip-icon': {
                              color: 'inherit'
                            }
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Breadcrumbs>
              ) : (
                <Typography variant="body2">{selectedLocation.name}</Typography>
              )}
            </Paper>
          )}

          {/* Help Text */}
          {!selectedLocation && !searchTerm && recentLocations.length === 0 && (
            <Alert severity="info" variant="outlined" sx={{ borderRadius: 1.5 }}>
              <Typography variant="body2">
                Search or browse to pick a location. You can select either an address (Country → Village) 
                or a structure (Office → Conference Room).
              </Typography>
            </Alert>
          )}

          {/* Selected Location Details */}
          {selectedLocation && (
            <Alert 
              severity="success" 
              variant="outlined" 
              sx={{ borderRadius: 1.5 }}
              action={
                <Button color="inherit" size="small" onClick={handleClear} startIcon={<CloseIcon />}>
                  Change
                </Button>
              }
            >
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {selectedLocation.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Code: {selectedLocation.code} | 
                  Type: {selectedLocation.location_mode === 'buildings' ? 'Structure' : 'Address'} |
                  Level: {selectedLocation.level}
                </Typography>
                {selectedLocation.description && (
                  <Typography variant="caption" color="text.secondary">
                    {selectedLocation.description}
                  </Typography>
                )}
              </Stack>
            </Alert>
          )}

          {/* GPS Quick Action */}
          {selectedLocation?.gps_coordinates && (
            <Alert severity="info" variant="outlined" icon={<GpsFixedIcon />} sx={{ borderRadius: 1.5 }}>
              <Typography variant="caption">
                GPS Coordinates available for this location
              </Typography>
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
});

LocationSearch.displayName = 'LocationSearch';

export default LocationSearch;