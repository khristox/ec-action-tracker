// src/components/address/LocationManager.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  Divider,
  Card,
  CardContent,
  Grid,
  Avatar,
  Skeleton,
  useTheme,
  useMediaQuery,
  ToggleButton,
  ToggleButtonGroup,
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  alpha,
  Fade,
  Grow,
  Zoom,
  Menu as MenuComponent,
  MenuItem as MenuItemComponent
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  Home as HomeIcon,
  Map as MapIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Apartment as ApartmentIcon,
  MeetingRoom as MeetingRoomIcon,
  EventSeat as EventSeatIcon,
  Chair as ChairIcon,
  DataUsage as DataUsageIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  ViewQuilt as ViewQuiltIcon,
  GridView as GridViewIcon,
  Clear as ClearIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  NavigateNext as NavigateNextIcon,
  FilterAlt as FilterAltIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import api from '../../services/api';
import AddressForm from './AddressForm';
import BuildingForm from './BuildingForm';

// ==================== Constants ====================

const ADDRESS_LEVELS = [
  { level: 1, name: 'Country', icon: <PublicIcon />, color: '#4CAF50', darkColor: '#81C784', description: 'Sovereign nations' },
  { level: 2, name: 'Region', icon: <FlagIcon />, color: '#2196F3', darkColor: '#64B5F6', description: 'States, provinces, or regions' },
  { level: 3, name: 'District', icon: <TerrainIcon />, color: '#9C27B0', darkColor: '#CE93D8', description: 'Administrative districts' },
  { level: 4, name: 'County', icon: <BusinessIcon />, color: '#FF9800', darkColor: '#FFB74D', description: 'Counties or municipalities' },
  { level: 5, name: 'Subcounty', icon: <HomeIcon />, color: '#795548', darkColor: '#A1887F', description: 'Subcounty divisions' },
  { level: 6, name: 'Parish', icon: <LocationIcon />, color: '#607D8B', darkColor: '#90A4AE', description: 'Parishes or wards' },
  { level: 7, name: 'Village', icon: <HomeIcon />, color: '#8BC34A', darkColor: '#AED581', description: 'Villages or hamlets' }
];

const BUILDINGS_LEVELS = [
  { level: 11, name: 'Office', icon: <ApartmentIcon />, color: '#E91E63', darkColor: '#F06292', description: 'Main office complexes' },
  { level: 12, name: 'Building', icon: <BusinessIcon />, color: '#3F51B5', darkColor: '#7986CB', description: 'Individual buildings' },
  { level: 13, name: 'Room', icon: <MeetingRoomIcon />, color: '#009688', darkColor: '#4DB6AC', description: 'Rooms or suites' },
  { level: 14, name: 'Conference', icon: <EventSeatIcon />, color: '#673AB7', darkColor: '#9575CD', description: 'Conference rooms' }
];

const VIEW_MODES = {
  TABLE: 'table',
  GRID: 'grid',
  TREE: 'tree'
};

// ==================== Hierarchical Path Component ====================

const HierarchicalPath = ({ location, maxLevels = 4 }) => {
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  useEffect(() => {
    if (location.parent_id) {
      fetchAncestors();
    } else {
      setAncestors([]);
    }
  }, [location.id, location.parent_id]);
  
  const fetchAncestors = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/locations/${location.id}/ancestors`);
      setAncestors(response.data || []);
    } catch (err) {
      console.error('Error fetching ancestors:', err);
      setAncestors([]);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <CircularProgress size={16} />;
  }
  
  if (ancestors.length === 0) {
    return (
      <Chip
        label="Top Level"
        size="small"
        variant="outlined"
        sx={{ height: 20, fontSize: '0.7rem' }}
      />
    );
  }
  
  // Get the last few ancestors for display
  const displayAncestors = ancestors.slice(-maxLevels);
  const remainingCount = ancestors.length - displayAncestors.length;
  
  // Get level info for styling
  const getLevelInfo = (ancestor) => {
    if (ancestor.location_mode === 'buildings') {
      return BUILDINGS_LEVELS.find(l => l.level === ancestor.level);
    }
    return ADDRESS_LEVELS.find(l => l.level === ancestor.level);
  };
  
  return (
    <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap" useFlexGap>
      {remainingCount > 0 && (
        <Tooltip title={`${remainingCount} more parent levels`}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            +{remainingCount}
          </Typography>
        </Tooltip>
      )}
      {displayAncestors.map((ancestor, idx) => {
        const levelInfo = getLevelInfo(ancestor);
        return (
          <React.Fragment key={ancestor.id}>
            <Tooltip title={`${levelInfo?.name || `Level ${ancestor.level}`} - ${ancestor.code}`}>
              <Chip
                label={ancestor.name}
                size="small"
                variant="outlined"
                sx={{
                  height: 24,
                  fontSize: '0.7rem',
                  bgcolor: alpha(levelInfo?.color || theme.palette.primary.main, isDark ? 0.15 : 0.1),
                  borderColor: levelInfo?.color || theme.palette.primary.main,
                  '& .MuiChip-label': { px: 1 },
                  maxWidth: 120,
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }
                }}
                icon={levelInfo?.icon ? React.cloneElement(levelInfo.icon, { sx: { fontSize: 12 } }) : null}
              />
            </Tooltip>
            {idx < displayAncestors.length - 1 && (
              <ChevronRightIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
            )}
          </React.Fragment>
        );
      })}
      {location && (
        <>
          <ChevronRightIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Chip
            label={location.name}
            size="small"
            sx={{
              height: 24,
              fontSize: '0.7rem',
              bgcolor: alpha(theme.palette.primary.main, 0.15),
              borderColor: 'primary.main',
              color: 'primary.main',
              fontWeight: 600,
              '& .MuiChip-label': { px: 1 }
            }}
          />
        </>
      )}
    </Stack>
  );
};

// ==================== Location Card Component ====================

const LocationCard = ({ location, onEdit, onDelete, onView, onViewChildren, levelInfo }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Grow in timeout={300}>
      <Card 
        sx={{ 
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[isDark ? 8 : 4],
            borderColor: 'primary.main',
            bgcolor: isDark ? alpha(theme.palette.primary.main, 0.05) : alpha(theme.palette.primary.main, 0.02)
          }
        }}
        onClick={() => onView(location)}
      >
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar 
                sx={{ 
                  bgcolor: levelInfo?.color ? alpha(levelInfo.color, isDark ? 0.15 : 0.1) : alpha(theme.palette.primary.main, 0.1),
                  color: isDark ? levelInfo?.darkColor || levelInfo?.color : levelInfo?.color,
                  width: 48,
                  height: 48,
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'scale(1.05)'
                  }
                }}
              >
                {levelInfo?.icon || <LocationIcon />}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={600} color="text.primary">
                  {location.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                  {location.code}
                </Typography>
              </Box>
            </Stack>
            <IconButton 
              size="small" 
              onClick={(e) => { e.stopPropagation(); onEdit(location); }}
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <MoreVertIcon />
            </IconButton>
          </Stack>
          
          <Divider sx={{ my: 1.5, borderColor: 'divider' }} />
          
          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {levelInfo?.icon}
              {levelInfo?.name || `Level ${location.level}`}
            </Typography>
            {location.location_mode === 'address' && location.population && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                👥 Population: {location.population.toLocaleString()}
              </Typography>
            )}
            {location.area && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                📐 Area: {location.area.toLocaleString()} {location.location_mode === 'address' ? 'km²' : 'm²'}
              </Typography>
            )}
            {location.location_mode === 'buildings' && location.capacity && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                👤 Capacity: {location.capacity.toLocaleString()}
              </Typography>
            )}
          </Stack>
          
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Chip 
              label={location.location_mode} 
              size="small" 
              variant="outlined"
              icon={location.location_mode === 'address' ? <PublicIcon sx={{ fontSize: '1rem' }} /> : <ApartmentIcon sx={{ fontSize: '1rem' }} />}
              sx={{ borderColor: 'divider', color: 'text.secondary' }}
            />
            <Chip 
              label={location.status} 
              size="small" 
              color={location.status === 'active' ? 'success' : 'default'}
              variant={isDark ? "outlined" : "filled"}
              sx={{ 
                ...(location.status === 'active' && isDark && { borderColor: 'success.main', color: 'success.main' })
              }}
            />
            <Button 
              size="small" 
              variant="contained"
              color="primary"
              onClick={(e) => { e.stopPropagation(); onViewChildren(location); }}
              startIcon={<FolderIcon />}
              sx={{ ml: 'auto' }}
            >
              View Children
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Grow>
  );
};

// ==================== Tree View Component ====================

const TreeNode = ({ node, depth = 0, onSelect, selectedId, expandedNodes, onToggle, onLoadChildren }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.includes(node.id);
  const isSelected = selectedId === node.id;
  
  const levelInfo = node.location_mode === 'buildings' 
    ? BUILDINGS_LEVELS.find(l => l.level === node.level)
    : ADDRESS_LEVELS.find(l => l.level === node.level);
  
  return (
    <Box>
      <Stack 
        direction="row" 
        alignItems="center" 
        spacing={1}
        sx={{ 
          py: 1,
          px: 2,
          ml: depth * 3,
          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
          borderRadius: 1,
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) }
        }}
        onClick={() => onSelect(node)}
      >
        {hasChildren && (
          <IconButton 
            size="small" 
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            sx={{ color: 'text.secondary' }}
          >
            {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </IconButton>
        )}
        {!hasChildren && <Box sx={{ width: 32 }} />}
        
        <Avatar sx={{ 
          width: 28, 
          height: 28, 
          bgcolor: levelInfo?.color ? alpha(levelInfo.color, isDark ? 0.15 : 0.1) : alpha(theme.palette.primary.main, 0.1),
          color: isDark ? levelInfo?.darkColor || levelInfo?.color : levelInfo?.color
        }}>
          {levelInfo?.icon || <LocationIcon sx={{ fontSize: 16 }} />}
        </Avatar>
        
        <Typography variant="body2" fontWeight={isSelected ? 600 : 400} color="text.primary">
          {node.name}
        </Typography>
        
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
          ({node.code})
        </Typography>
        
        <Button
          size="small"
          variant="outlined"
          onClick={(e) => { e.stopPropagation(); onLoadChildren(node); }}
          startIcon={<FolderIcon />}
          sx={{ ml: 'auto' }}
        >
          Load Children
        </Button>
      </Stack>
      
      {hasChildren && isExpanded && (
        <Box>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onLoadChildren={onLoadChildren}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

// ==================== Navigation History Component ====================

const NavigationHistory = ({ history, onNavigateTo, onClearHistory }) => {
  const theme = useTheme();
  
  if (history.length === 0) return null;
  
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 1, 
        bgcolor: alpha(theme.palette.primary.main, 0.05),
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
        <HistoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Navigation History:
        </Typography>
        <MuiBreadcrumbs maxItems={5} separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}>
          {history.map((item, index) => (
            <Link
              key={item.id}
              component="button"
              variant="caption"
              onClick={() => onNavigateTo(item, index)}
              sx={{ 
                color: index === history.length - 1 ? 'primary.main' : 'text.secondary',
                cursor: 'pointer',
                textDecoration: 'none',
                '&:hover': { 
                  textDecoration: 'underline',
                  color: 'primary.main'
                }
              }}
            >
              {item.name}
            </Link>
          ))}
        </MuiBreadcrumbs>
        <Button 
          size="small" 
          variant="text" 
          onClick={onClearHistory}
          sx={{ ml: 'auto', minWidth: 'auto', p: 0.5 }}
        >
          <ClearIcon sx={{ fontSize: 14 }} />
        </Button>
      </Stack>
    </Paper>
  );
};

// ==================== Main Location Manager ====================

const LocationManager = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // State
  const [locations, setLocations] = useState([]);
  const [currentParent, setCurrentParent] = useState(null);
  const [parentHierarchy, setParentHierarchy] = useState([]);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMode, setSelectedMode] = useState('address');
  const [viewMode, setViewMode] = useState(VIEW_MODES.TABLE);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [expandedNodes, setExpandedNodes] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [filterLevel, setFilterLevel] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [availableParents, setAvailableParents] = useState([]);
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(debouncedSearch);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);
  
  // Fetch available parent locations for filtering
  const fetchAvailableParents = useCallback(async () => {
    try {
      const params = {
        location_mode: selectedMode,
        limit: 100,
        status: 'active'
      };
      const response = await api.get('/locations/', { params });
      setAvailableParents(response.data?.items || []);
    } catch (err) {
      console.error('Error fetching parents:', err);
    }
  }, [selectedMode]);
  
  // Fetch locations based on current parent with pagination
  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        ...(selectedMode && { location_mode: selectedMode }),
        ...(searchTerm && { search: searchTerm }),
        ...(filterLevel && { level: filterLevel }),
        ...(currentParent && { parent_id: currentParent.id })
      };
      const response = await api.get('/locations/', { params });
      setLocations(response.data?.items || []);
      setTotal(response.data?.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, selectedMode, searchTerm, filterLevel, currentParent]);
  
  // Fetch parent hierarchy
  const fetchParentHierarchy = useCallback(async () => {
    if (!currentParent) {
      setParentHierarchy([]);
      return;
    }
    try {
      const response = await api.get(`/locations/${currentParent.id}/ancestors`);
      setParentHierarchy(response.data || []);
    } catch (err) {
      console.error('Error fetching hierarchy:', err);
      setParentHierarchy([]);
    }
  }, [currentParent]);
  
  const fetchTree = useCallback(async () => {
    if (viewMode !== VIEW_MODES.TREE) return;
    setLoading(true);
    try {
      const params = { location_mode: selectedMode };
      const response = await api.get('/locations/tree', { params });
      setTreeData(response.data || []);
    } catch (err) { 
      console.error('Error fetching tree:', err); 
    } finally { 
      setLoading(false); 
    }
  }, [selectedMode, viewMode]);
  
  const fetchStatistics = useCallback(async () => {
    try {
      const response = await api.get('/locations/statistics');
      setStatistics(response.data);
    } catch (err) { 
      console.error('Error fetching statistics:', err); 
    }
  }, []);
  
  useEffect(() => {
    fetchLocations();
    fetchParentHierarchy();
    fetchStatistics();
    fetchAvailableParents();
  }, [fetchLocations, fetchParentHierarchy, fetchStatistics, fetchAvailableParents]);
  
  useEffect(() => {
    if (viewMode === VIEW_MODES.TREE) {
      fetchTree();
    }
  }, [fetchTree, viewMode]);
  
  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [selectedMode, filterLevel, currentParent, searchTerm]);
  
  // Handlers
  const handleModeChange = (event, newMode) => {
    if (newMode !== null) {
      setSelectedMode(newMode);
      setFilterLevel(null);
      setSearchTerm('');
      setDebouncedSearch('');
      setCurrentParent(null);
      setParentHierarchy([]);
      setNavigationHistory([]);
      setPage(0);
    }
  };
  
  const handleViewChange = (event, newView) => {
    if (newView !== null) {
      setViewMode(newView);
      setPage(0);
    }
  };
  
  const handleViewChildren = (location) => {
    // Add current location to navigation history before navigating
    if (currentParent) {
      setNavigationHistory(prev => [...prev, currentParent]);
    }
    setCurrentParent(location);
    setPage(0);
  };
  
  const handleNavigateToHistory = (location, index) => {
    // Remove all history items after this index
    const newHistory = navigationHistory.slice(0, index);
    setNavigationHistory(newHistory);
    setCurrentParent(location);
    setPage(0);
  };
  
  const handleClearHistory = () => {
    setNavigationHistory([]);
  };
  
  const handleNavigateToParent = (parent) => {
    // Add current to history if not already there
    if (currentParent) {
      setNavigationHistory(prev => [...prev, currentParent]);
    }
    setCurrentParent(parent);
    setPage(0);
  };
  
  const handleNavigateUp = () => {
    if (parentHierarchy.length > 0) {
      const newParent = parentHierarchy[parentHierarchy.length - 1];
      // Add current to history
      if (currentParent) {
        setNavigationHistory(prev => [...prev, currentParent]);
      }
      setCurrentParent(newParent);
    } else {
      // Add current to history before going to root
      if (currentParent) {
        setNavigationHistory(prev => [...prev, currentParent]);
      }
      setCurrentParent(null);
    }
    setPage(0);
  };
  
  const handleNavigateToRoot = () => {
    // Add current to history before going to root
    if (currentParent) {
      setNavigationHistory(prev => [...prev, currentParent]);
    }
    setCurrentParent(null);
    setParentHierarchy([]);
    setPage(0);
  };
  
  const handleFilterByParent = (parent) => {
    if (parent) {
      setCurrentParent(parent);
    } else {
      setCurrentParent(null);
    }
    setFilterAnchorEl(null);
    setPage(0);
  };
  
  const handleOpenFilterMenu = (event) => {
    setFilterAnchorEl(event.currentTarget);
  };
  
  const handleCloseFilterMenu = () => {
    setFilterAnchorEl(null);
  };
  
  const handleCreate = () => { 
    setSelectedLocation(null); 
    setFormMode('create'); 
    setFormOpen(true); 
  };
  
  const handleEdit = (location) => { 
    setSelectedLocation(location); 
    setFormMode('edit'); 
    setFormOpen(true); 
  };
  
  const handleDelete = async (location) => {
    if (!window.confirm(`Delete "${location.name}" and all its children?`)) return;
    try {
      await api.delete(`/locations/${location.id}`);
      fetchLocations();
      fetchStatistics();
      if (viewMode === VIEW_MODES.TREE) fetchTree();
      fetchAvailableParents();
    } catch (err) { 
      setError(err.response?.data?.detail || 'Failed to delete'); 
    }
  };
  
  const handleFormSuccess = () => {
    fetchLocations(); 
    fetchStatistics();
    if (viewMode === VIEW_MODES.TREE) fetchTree();
    fetchAvailableParents();
    setFormOpen(false);
  };
  
  const handleExport = async () => {
    try {
      const response = await api.get('/locations/export', { 
        params: { location_mode: selectedMode }, 
        responseType: 'blob' 
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `locations_${selectedMode}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link); 
      link.click(); 
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { 
      setError('Failed to export'); 
    }
  };
  
  const handleClearFilters = () => {
    setFilterLevel(null);
    setSearchTerm('');
    setDebouncedSearch('');
    setCurrentParent(null);
    setNavigationHistory([]);
    setPage(0);
  };
  
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const handleToggleNode = (nodeId) => {
    setExpandedNodes(prev => 
      prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
    );
  };
  
  const getLevelInfo = (location) => {
    if (location.location_mode === 'buildings') {
      return BUILDINGS_LEVELS.find(l => l.level === location.level);
    }
    return ADDRESS_LEVELS.find(l => l.level === location.level);
  };
  
  const filterOptions = useMemo(() => {
    const levels = selectedMode === 'buildings' ? BUILDINGS_LEVELS : ADDRESS_LEVELS;
    return { levels };
  }, [selectedMode]);
  
  const hasActiveFilters = filterLevel || searchTerm || currentParent;
  
  if (loading && locations.length === 0 && !currentParent) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1, bgcolor: 'action.hover' }} />
          <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1, bgcolor: 'action.hover' }} />
        </Stack>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 }, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Fade in timeout={500}>
        <Stack spacing={3}>
          {/* Header */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              bgcolor: 'background.paper', 
              borderRadius: 2, 
              border: `1px solid ${theme.palette.divider}`,
              backgroundImage: 'none'
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                  <LocationIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={700} color="text.primary">
                    Location Manager
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage {selectedMode === 'address' ? 'address hierarchies' : 'building structures'}
                  </Typography>
                </Box>
                {statistics && (
                  <Chip 
                    label={`${statistics.by_mode?.[selectedMode] || 0} ${selectedMode === 'address' ? 'addresses' : 'buildings'}`} 
                    size="small" 
                    variant="outlined"
                    sx={{ borderColor: 'divider' }}
                  />
                )}
              </Stack>
              
              <Stack direction="row" spacing={1}>
                <Tooltip title="Export Data">
                  <IconButton onClick={handleExport} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Refresh">
                  <IconButton onClick={fetchLocations} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />} 
                  onClick={handleCreate}
                  sx={{ 
                    bgcolor: 'primary.main',
                    '&:hover': { bgcolor: 'primary.dark' }
                  }}
                >
                  New {selectedMode === 'address' ? 'Address' : 'Building'}
                </Button>
              </Stack>
            </Stack>
          </Paper>
          
          {/* Navigation History */}
          <NavigationHistory 
            history={navigationHistory}
            onNavigateTo={handleNavigateToHistory}
            onClearHistory={handleClearHistory}
          />
          
          {/* Filter by Parent Button */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              bgcolor: 'background.paper', 
              borderRadius: 2, 
              border: `1px solid ${theme.palette.divider}`,
              backgroundImage: 'none'
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
              <Button
                variant={currentParent ? "contained" : "outlined"}
                startIcon={<FilterAltIcon />}
                onClick={handleOpenFilterMenu}
                color={currentParent ? "primary" : "inherit"}
              >
                {currentParent ? `Filtered by: ${currentParent.name}` : 'Filter by Parent Location'}
              </Button>
              
              {currentParent && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleNavigateUp}
                    startIcon={<ArrowBackIcon />}
                  >
                    Up to Parent
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleNavigateToRoot}
                  >
                    Clear Filter
                  </Button>
                  <MuiBreadcrumbs 
                    separator={<NavigateNextIcon fontSize="small" />}
                    sx={{ ml: 2 }}
                  >
                    <Link
                      component="button"
                      variant="body2"
                      onClick={handleNavigateToRoot}
                      sx={{ 
                        color: 'text.secondary',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      Root
                    </Link>
                    {parentHierarchy.map((parent, index) => (
                      <Link
                        key={parent.id}
                        component="button"
                        variant="body2"
                        onClick={() => handleNavigateToParent(parent)}
                        sx={{ 
                          color: 'text.secondary',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                      >
                        {parent.name}
                      </Link>
                    ))}
                    {currentParent && (
                      <Typography color="primary.main" variant="body2" fontWeight={600}>
                        {currentParent.name}
                      </Typography>
                    )}
                  </MuiBreadcrumbs>
                </>
              )}
            </Stack>
          </Paper>
          
          {/* Parent Filter Menu */}
          <MenuComponent
            anchorEl={filterAnchorEl}
            open={Boolean(filterAnchorEl)}
            onClose={handleCloseFilterMenu}
            PaperProps={{
              sx: {
                maxHeight: 400,
                width: '300px',
                bgcolor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`
              }
            }}
          >
            <MenuItemComponent onClick={() => { handleFilterByParent(null); handleCloseFilterMenu(); }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <LocationIcon fontSize="small" />
                <Typography variant="body2">All Locations (No Filter)</Typography>
              </Stack>
            </MenuItemComponent>
            <Divider />
            {availableParents.map((parent) => (
              <MenuItemComponent 
                key={parent.id} 
                onClick={() => handleFilterByParent(parent)}
                selected={currentParent?.id === parent.id}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Avatar sx={{ width: 24, height: 24 }}>
                    {parent.location_mode === 'address' ? <PublicIcon sx={{ fontSize: 14 }} /> : <ApartmentIcon sx={{ fontSize: 14 }} />}
                  </Avatar>
                  <Box>
                    <Typography variant="body2">{parent.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {parent.code} • Level {parent.level}
                    </Typography>
                  </Box>
                </Stack>
              </MenuItemComponent>
            ))}
            {availableParents.length === 0 && (
              <MenuItemComponent disabled>
                <Typography variant="body2" color="text.secondary">No locations available</Typography>
              </MenuItemComponent>
            )}
          </MenuComponent>
          
          {/* Mode & View Toggles */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 1.5, 
              bgcolor: 'background.paper', 
              borderRadius: 2, 
              border: `1px solid ${theme.palette.divider}`,
              backgroundImage: 'none'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={2}>
              <ToggleButtonGroup 
                value={selectedMode} 
                exclusive 
                onChange={handleModeChange} 
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    color: 'text.secondary',
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      borderColor: 'primary.main'
                    }
                  }
                }}
              >
                <ToggleButton value="address">
                  <PublicIcon sx={{ mr: 1 }} /> Addresses
                </ToggleButton>
                <ToggleButton value="buildings">
                  <ApartmentIcon sx={{ mr: 1 }} /> Buildings
                </ToggleButton>
              </ToggleButtonGroup>
              
              <ToggleButtonGroup 
                value={viewMode} 
                exclusive 
                onChange={handleViewChange} 
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    color: 'text.secondary',
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      borderColor: 'primary.main'
                    }
                  }
                }}
              >
                <ToggleButton value={VIEW_MODES.TABLE}><ViewListIcon /></ToggleButton>
                <ToggleButton value={VIEW_MODES.GRID}><GridViewIcon /></ToggleButton>
                <ToggleButton value={VIEW_MODES.TREE}><ViewQuiltIcon /></ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Paper>
          
          {/* Statistics Cards */}
          {statistics && !currentParent && (
            <Grid container spacing={2}>
              {[
                { 
                  label: `Total ${selectedMode === 'address' ? 'Addresses' : 'Buildings'}`, 
                  value: statistics.by_mode?.[selectedMode] || 0,
                  icon: selectedMode === 'address' ? <PublicIcon /> : <ApartmentIcon />
                },
                { label: 'With GPS', value: statistics.with_gps || 0, icon: <MapIcon /> },
                { label: 'Active', value: statistics.by_status?.active || 0, icon: <CheckCircleIcon /> }
              ].map((stat, idx) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
                  <Zoom in timeout={300 + idx * 100}>
                    <Card 
                      elevation={0} 
                      sx={{ 
                        bgcolor: 'background.paper', 
                        borderRadius: 2, 
                        border: `1px solid ${theme.palette.divider}`,
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                        <Avatar sx={{ mx: 'auto', mb: 1, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                          {stat.icon}
                        </Avatar>
                        <Typography variant="h3" fontWeight={700} color="primary.main">
                          {stat.value}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                          {stat.label}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Zoom>
                </Grid>
              ))}
            </Grid>
          )}
          
          {/* Current Location Context Alert */}
          {currentParent && (
            <Alert 
              severity="info" 
              icon={<FolderIcon />}
              sx={{ 
                bgcolor: alpha(theme.palette.info.main, 0.1),
                borderColor: 'info.main',
                '& .MuiAlert-icon': { color: 'info.main' }
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={1}>
                <Typography variant="body2">
                  <strong>Showing children of:</strong> {currentParent.name} ({currentParent.code})
                </Typography>
                <Button 
                  size="small" 
                  variant="outlined" 
                  onClick={handleNavigateUp}
                  startIcon={<ArrowBackIcon />}
                >
                  Back to Parent
                </Button>
              </Stack>
            </Alert>
          )}
          
          {/* Filters */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              bgcolor: 'background.paper', 
              borderRadius: 2, 
              border: `1px solid ${theme.palette.divider}`,
              backgroundImage: 'none'
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                size="small"
                placeholder={`Search ${selectedMode === 'address' ? 'addresses' : 'buildings'} by name or code...`}
                value={debouncedSearch}
                onChange={(e) => setDebouncedSearch(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'background.default',
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                    '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: debouncedSearch && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setDebouncedSearch('')} sx={{ color: 'text.secondary' }}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ color: 'text.secondary' }}>Level</InputLabel>
                <Select 
                  value={filterLevel || ''} 
                  label="Level" 
                  onChange={(e) => setFilterLevel(e.target.value || null)}
                  sx={{
                    bgcolor: 'background.default',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' }
                  }}
                >
                  <MenuItem value="">All Levels</MenuItem>
                  {filterOptions.levels.map(level => {
                    return (
                      <MenuItem key={level.level} value={level.level}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar sx={{ 
                            width: 24, 
                            height: 24, 
                            bgcolor: alpha(level.color, isDark ? 0.15 : 0.1), 
                            color: isDark ? level.darkColor || level.color : level.color,
                            fontSize: 14
                          }}>
                            {level.icon}
                          </Avatar>
                          <span>{level.name}</span>
                        </Stack>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              
              {hasActiveFilters && (
                <Button 
                  onClick={handleClearFilters}
                  startIcon={<ClearIcon />}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                >
                  Clear All Filters
                </Button>
              )}
            </Stack>
          </Paper>
          
          {error && (
            <Alert 
              severity="error" 
              onClose={() => setError(null)}
              variant={isDark ? "outlined" : "standard"}
              sx={{ borderColor: 'error.main' }}
            >
              {error}
            </Alert>
          )}
          
          {/* Loading Indicator */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          
          {/* Table View */}
          {!loading && viewMode === VIEW_MODES.TABLE && (
            <Paper 
              elevation={0} 
              sx={{ 
                bgcolor: 'background.paper', 
                borderRadius: 2, 
                border: `1px solid ${theme.palette.divider}`,
                overflow: 'hidden'
              }}
            >
              <TableContainer sx={{ maxHeight: '70vh' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'background.default' }}>
                      <TableCell sx={{ fontWeight: 700, color: 'text.primary', borderBottomColor: 'divider' }}>Code</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'text.primary', borderBottomColor: 'divider' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'text.primary', borderBottomColor: 'divider' }}>Hierarchy Path</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'text.primary', borderBottomColor: 'divider' }}>Level</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'text.primary', borderBottomColor: 'divider' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'text.primary', borderBottomColor: 'divider' }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {locations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                          <Stack alignItems="center" spacing={1}>
                            <LocationIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                            <Typography color="text.secondary">No locations found</Typography>
                            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate} size="small">
                              Create your first {selectedMode === 'address' ? 'address' : 'building'}
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ) : (
                      locations.map((location) => {
                        const levelInfo = getLevelInfo(location);
                        return (
                          <TableRow key={location.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                {location.code}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Avatar sx={{ 
                                  width: 28, 
                                  height: 28, 
                                  bgcolor: levelInfo?.color ? alpha(levelInfo.color, isDark ? 0.15 : 0.1) : 'action.hover',
                                  color: isDark ? levelInfo?.darkColor || levelInfo?.color : levelInfo?.color
                                }}>
                                  {levelInfo?.icon}
                                </Avatar>
                                <Typography variant="body2" fontWeight={500} color="text.primary">
                                  {location.name}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <HierarchicalPath location={location} maxLevels={4} />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={levelInfo?.name || `L${location.level}`} 
                                size="small"
                                sx={{ 
                                  bgcolor: levelInfo?.color ? alpha(levelInfo.color, isDark ? 0.15 : 0.1) : 'action.hover',
                                  color: isDark ? levelInfo?.darkColor || levelInfo?.color : levelInfo?.color,
                                  fontWeight: 600
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={location.status} 
                                size="small" 
                                color={location.status === 'active' ? 'success' : 'default'}
                                variant={isDark ? "outlined" : "filled"}
                                sx={{ 
                                  ...(location.status === 'active' && isDark && { borderColor: 'success.main', color: 'success.main' })
                                }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Stack direction="row" spacing={0.5} justifyContent="center">
                                <Tooltip title="View Children">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleViewChildren(location)} 
                                    sx={{ color: 'text.secondary', '&:hover': { color: 'info.main' } }}
                                  >
                                    <FolderIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleEdit(location)} 
                                    sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleDelete(location)} 
                                    sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {locations.length > 0 && (
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, 50, 100]}
                  component="div"
                  count={total}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handlePageChange}
                  onRowsPerPageChange={handleRowsPerPageChange}
                  sx={{ 
                    borderTop: `1px solid ${theme.palette.divider}`,
                    '& .MuiTablePagination-displayedRows': {
                      color: 'text.secondary'
                    }
                  }}
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
                />
              )}
            </Paper>
          )}
          
          {/* Grid View */}
          {!loading && viewMode === VIEW_MODES.GRID && (
            <>
              <Grid container spacing={2}>
                {locations.map((location) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={location.id}>
                    <LocationCard 
                      location={location} 
                      levelInfo={getLevelInfo(location)} 
                      onEdit={handleEdit} 
                      onDelete={handleDelete} 
                      onView={handleEdit}
                      onViewChildren={handleViewChildren}
                    />
                  </Grid>
                ))}
              </Grid>
              {locations.length === 0 && (
                <Paper sx={{ p: 8, textAlign: 'center', bgcolor: 'background.paper' }}>
                  <LocationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography color="text.secondary">No locations found</Typography>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreate} sx={{ mt: 2 }}>
                    Create your first {selectedMode === 'address' ? 'address' : 'building'}
                  </Button>
                </Paper>
              )}
              {locations.length > 0 && (
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, 50, 100]}
                  component="div"
                  count={total}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handlePageChange}
                  onRowsPerPageChange={handleRowsPerPageChange}
                  sx={{ 
                    mt: 2,
                    '& .MuiTablePagination-displayedRows': {
                      color: 'text.secondary'
                    }
                  }}
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
                />
              )}
            </>
          )}
          
          {/* Tree View */}
          {!loading && viewMode === VIEW_MODES.TREE && (
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                bgcolor: 'background.paper', 
                borderRadius: 2, 
                border: `1px solid ${theme.palette.divider}`,
                maxHeight: '70vh',
                overflow: 'auto'
              }}
            >
              {treeData.length === 0 ? (
                <Box sx={{ p: 8, textAlign: 'center' }}>
                  <LocationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography color="text.secondary">No hierarchical data available</Typography>
                </Box>
              ) : (
                treeData.map(node => (
                  <TreeNode 
                    key={node.id} 
                    node={node} 
                    onSelect={handleEdit} 
                    selectedId={selectedLocation?.id} 
                    expandedNodes={expandedNodes} 
                    onToggle={handleToggleNode}
                    onLoadChildren={handleViewChildren}
                  />
                ))
              )}
            </Paper>
          )}
        </Stack>
      </Fade>
      
      {/* Conditional Form Rendering */}
      {selectedMode === 'address' ? (
        <AddressForm 
          open={formOpen} 
          onClose={() => setFormOpen(false)} 
          onSuccess={handleFormSuccess} 
          initialData={selectedLocation} 
          mode={formMode}
        />
      ) : (
        <BuildingForm 
          open={formOpen} 
          onClose={() => setFormOpen(false)} 
          onSuccess={handleFormSuccess} 
          initialData={selectedLocation} 
          mode={formMode}
        />
      )}
    </Container>
  );
};

export default LocationManager;