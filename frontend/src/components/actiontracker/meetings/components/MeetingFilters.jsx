// src/components/actiontracker/meetings/components/MeetingFilters.jsx

import { useEffect } from 'react';
import { 
  Stack, TextField, InputAdornment, IconButton, 
  FormControl, InputLabel, Select, MenuItem, Button, 
  ToggleButtonGroup, ToggleButton, Box, Chip, 
  FormControlLabel, Switch, useMediaQuery, useTheme,
  CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import { COLORS } from '../styles/colors';

export const MeetingFilters = ({ 
  searchTerm, 
  setSearchTerm, 
  statusFilter, 
  setStatusFilter, 
  statusOptions = [], 
  loading = false, 
  showUpcoming,
  setShowUpcoming,
  showPast,
  setShowPast,
  viewMode, 
  setViewMode, 
  onClearFilters, 
  onOpenFilterDrawer,
  isMobile 
}) => {
  const theme = useTheme();
  const isMobileView = isMobile !== undefined ? isMobile : useMediaQuery(theme.breakpoints.down('sm'));

  const handleStatusChange = (event) => {
    setStatusFilter(event.target.value);
  };

  const handleClear = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setShowUpcoming(true);
    setShowPast(false);
    onClearFilters();
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || showPast || !showUpcoming;

  // Safe helper to find a matching option's label
  const getStatusLabel = (filterValue) => {
    const matchedOption = statusOptions?.find(
      (o) => (o.value || o.short_name || o.id) === filterValue
    );
    return matchedOption ? (matchedOption.label || matchedOption.name || matchedOption.short_name) : filterValue;
  };

  useEffect(() => {
  }, [statusOptions]);

  return (
    <Stack spacing={2}>
      {/* Main filter row */}
      <Stack 
        direction={isMobileView ? 'column' : 'row'} 
        spacing={2} 
        sx={{ alignItems: 'center' }} 
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Search meetings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          // Fixed: Switched to React 19 / MUI modern slots to prevent DOM attribute bleeding warnings
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: COLORS.secondary }} />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }
          }}
        />
        
        {isMobileView ? (
          <Button 
            fullWidth 
            variant="outlined" 
            startIcon={<FilterListIcon />} 
            onClick={onOpenFilterDrawer}
          >
            {statusFilter !== 'all' 
              ? `Status: ${getStatusLabel(statusFilter)}`
              : 'Filter Meetings'
            }
          </Button>
        ) : (
          <FormControl sx={{ minWidth: 220 }} size="small">
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select 
              labelId="status-filter-label"
              value={statusFilter} 
              onChange={handleStatusChange} 
              label="Status"
              disabled={loading}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              {loading ? (
                <MenuItem disabled>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    Loading...
                  </Box>
                </MenuItem>
              ) : (
                statusOptions?.map(opt => {
                  const value = opt.value || opt.short_name || opt.id;
                  const label = opt.label || opt.name || opt.short_name;
                  const color = opt.color || '#6B7280';
                  
                  return (
                    <MenuItem key={value} value={value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          bgcolor: color 
                        }} />
                        {label}
                      </Box>
                    </MenuItem>
                  );
                })
              )}
            </Select>
          </FormControl>
        )}
        
        <ToggleButtonGroup 
          value={viewMode} 
          exclusive 
          onChange={(e, val) => val && setViewMode(val)} 
          size="small" 
          sx={{ ml: isMobileView ? 0 : 'auto' }}
        >
          <ToggleButton value="grid"><GridViewIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="table"><ViewListIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      
      {/* Date filter row */}
      <Stack 
        direction="row" 
        spacing={2} 
        sx={{ alignItems: 'center', flexWrap: 'wrap' }} 
      >
        <FormControlLabel
          control={
            <Switch 
              checked={showUpcoming} 
              onChange={(e) => setShowUpcoming(e.target.checked)}
              size="small"
              color="primary"
            />
          }
          label="Show Upcoming"
          sx={{ mr: 1 }}
        />
        
        <FormControlLabel
          control={
            <Switch 
              checked={showPast} 
              onChange={(e) => setShowPast(e.target.checked)}
              size="small"
              color="secondary"
            />
          }
          label="Show Past"
          sx={{ mr: 1 }}
        />
        
        {hasActiveFilters && !isMobileView && (
          <Button onClick={handleClear} startIcon={<ClearIcon />} size="small" sx={{ ml: 'auto' }}>
            Clear All Filters
          </Button>
        )}
      </Stack>
      
      {/* Active filters display */}
      {hasActiveFilters && (
        <Stack 
          direction="row" 
          sx={{ 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: 1 
          }}
        >
          {searchTerm && (
            <Chip 
              label={`Search: ${searchTerm}`} 
              size="small" 
              onDelete={() => setSearchTerm('')}
              variant="outlined"
            />
          )}
          {statusFilter !== 'all' && (
            <Chip 
              label={`Status: ${getStatusLabel(statusFilter)}`}
              size="small" 
              onDelete={() => setStatusFilter('all')}
              variant="outlined"
            />
          )}
          {showPast && (
            <Chip 
              label="Showing Past Meetings" 
              size="small" 
              onDelete={() => setShowPast(false)}
              variant="outlined"
            />
          )}
          {!showUpcoming && (
            <Chip 
              label="Hidden Upcoming" 
              size="small" 
              onDelete={() => setShowUpcoming(true)}
              variant="outlined"
            />
          )}
        </Stack>
      )}
    </Stack>
  );
};