// src/components/actiontracker/meetings/components/MobileFilterDrawer.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Box, SwipeableDrawer, Stack, Typography, IconButton, 
  TextField, InputAdornment, Chip, Button, FormControlLabel, Switch,
  Divider, useMediaQuery, useTheme
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { StatusChip } from './StatusChip';

export const MobileFilterDrawer = ({ 
  open, 
  onClose, 
  statusFilter, 
  setStatusFilter, 
  statusOptions = [],  // Default to empty array
  searchTerm = '',      // Default values
  setSearchTerm,
  showUpcoming = true,
  setShowUpcoming,
  showPast = false,
  setShowPast,
  onClearFilters,
  totalResults = 0,     // Optional: show filtered results count
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Local state for form values
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [localStatusFilter, setLocalStatusFilter] = useState(statusFilter);
  const [localShowUpcoming, setLocalShowUpcoming] = useState(showUpcoming);
  const [localShowPast, setLocalShowPast] = useState(showPast);
  
  // Track if filters have been modified
  const hasChanges = useMemo(() => {
    return localSearchTerm !== searchTerm ||
           localStatusFilter !== statusFilter ||
           localShowUpcoming !== showUpcoming ||
           localShowPast !== showPast;
  }, [localSearchTerm, localStatusFilter, localShowUpcoming, localShowPast, 
      searchTerm, statusFilter, showUpcoming, showPast]);

  // Sync local state with props when drawer opens
  useEffect(() => {
    if (open) {
      setLocalSearchTerm(searchTerm);
      setLocalStatusFilter(statusFilter);
      setLocalShowUpcoming(showUpcoming);
      setLocalShowPast(showPast);
    }
  }, [open, searchTerm, statusFilter, showUpcoming, showPast]);

  // Handle apply filters
  const handleApply = useCallback(() => {
    setSearchTerm(localSearchTerm);
    setStatusFilter(localStatusFilter);
    setShowUpcoming(localShowUpcoming);
    setShowPast(localShowPast);
    onClose();
  }, [localSearchTerm, localStatusFilter, localShowUpcoming, localShowPast, 
      setSearchTerm, setStatusFilter, setShowUpcoming, setShowPast, onClose]);

  // Handle clear all filters
  const handleClear = useCallback(() => {
    setLocalSearchTerm('');
    setLocalStatusFilter('all');
    setLocalShowUpcoming(true);
    setLocalShowPast(false);
    
    if (onClearFilters) {
      onClearFilters();
    }
    onClose();
  }, [onClearFilters, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && open) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (statusFilter !== 'all') count++;
    if (!showUpcoming) count++;
    if (showPast) count++;
    return count;
  }, [searchTerm, statusFilter, showUpcoming, showPast]);

  return (
    <SwipeableDrawer 
      anchor="bottom" 
      open={open} 
      onClose={onClose} 
      onOpen={() => {}}
      disableSwipeToOpen={false}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '90vh',
        }
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 3 }, pb: 4 }}>
        {/* Header */}
        <Stack 
          direction="row" 
          justifyContent="space-between" 
          alignItems="center" 
          mb={2}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterAltIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Filters
              {activeFilterCount > 0 && (
                <Typography 
                  component="span" 
                  variant="caption" 
                  sx={{ ml: 1, color: 'primary.main' }}
                >
                  ({activeFilterCount} active)
                </Typography>
              )}
            </Typography>
          </Stack>
          <IconButton 
            onClick={onClose} 
            edge="end"
            aria-label="Close filters"
          >
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider sx={{ mb: 3 }} />

        {/* Search Field */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search by title, description, or attendee..."
          value={localSearchTerm}
          onChange={(e) => setLocalSearchTerm(e.target.value)}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: localSearchTerm && (
              <InputAdornment position="end">
                <IconButton 
                  size="small" 
                  onClick={() => setLocalSearchTerm('')}
                  edge="end"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            )
          }}
        />

        {/* Status Filter */}
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Status
        </Typography>
        <Stack 
          direction="row" 
          spacing={1} 
          flexWrap="wrap" 
          useFlexGap
          sx={{ mb: 3, gap: 1 }}
        >
          <Chip 
            label="All" 
            onClick={() => setLocalStatusFilter('all')} 
            color={localStatusFilter === 'all' ? 'primary' : 'default'}
            variant={localStatusFilter === 'all' ? 'filled' : 'outlined'}
            aria-pressed={localStatusFilter === 'all'}
          />
          {statusOptions.map(opt => (
            <Chip 
              key={opt.value}
              label={opt.label}
              onClick={() => setLocalStatusFilter(opt.value)}
              color={localStatusFilter === opt.value ? 'primary' : 'default'}
              variant={localStatusFilter === opt.value ? 'filled' : 'outlined'}
              sx={{ 
                bgcolor: localStatusFilter === opt.value ? opt.color : 'transparent',
                '&:hover': { 
                  bgcolor: opt.color,
                  opacity: 0.8 
                }
              }}
              aria-pressed={localStatusFilter === opt.value}
            />
          ))}
        </Stack>

        <Divider sx={{ mb: 3 }} />

        {/* Date Range Filter */}
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Date Range
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch 
                checked={localShowUpcoming} 
                onChange={(e) => setLocalShowUpcoming(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Stack>
                <Typography variant="body2">Show Upcoming Meetings</Typography>
                <Typography variant="caption" color="text.secondary">
                  Scheduled for future dates
                </Typography>
              </Stack>
            }
            sx={{ alignItems: 'flex-start', m: 0 }}
          />
          <FormControlLabel
            control={
              <Switch 
                checked={localShowPast} 
                onChange={(e) => setLocalShowPast(e.target.checked)}
                color="secondary"
              />
            }
            label={
              <Stack>
                <Typography variant="body2">Show Past Meetings</Typography>
                <Typography variant="caption" color="text.secondary">
                  Already completed meetings
                </Typography>
              </Stack>
            }
            sx={{ alignItems: 'flex-start', m: 0 }}
          />
        </Stack>

        {/* Optional: Show total results */}
        {totalResults > 0 && (
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ display: 'block', mb: 2, textAlign: 'center' }}
          >
            {totalResults} meeting{totalResults !== 1 ? 's' : ''} found
          </Typography>
        )}

        <Divider sx={{ mb: 3 }} />

        {/* Action Buttons */}
        <Stack direction="row" spacing={2}>
          <Button 
            fullWidth 
            variant="outlined" 
            onClick={handleClear}
            startIcon={<ClearAllIcon />}
            disabled={!hasChanges && activeFilterCount === 0}
          >
            Clear All
          </Button>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={handleApply}
            disabled={!hasChanges}
          >
            Apply Filters
          </Button>
        </Stack>
      </Box>
    </SwipeableDrawer>
  );
};

// Optional: Add prop types for better documentation
MobileFilterDrawer.displayName = 'MobileFilterDrawer';