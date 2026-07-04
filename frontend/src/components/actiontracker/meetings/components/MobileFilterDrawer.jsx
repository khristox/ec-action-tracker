// src/components/actiontracker/meetings/components/MobileFilterDrawer.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Box, SwipeableDrawer, Stack, Typography, IconButton, 
  TextField, InputAdornment, Chip, Button, FormControlLabel, Switch,
  Divider, useMediaQuery, useTheme, alpha, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import Close from '@mui/icons-material/Close';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Cancel from '@mui/icons-material/Cancel';

// Status color mapping based on common meeting statuses
const getStatusColor = (statusId, statusOptions) => {
  const status = statusOptions?.find(s => s.id === statusId || s.value === statusId);
  if (status?.color) return status.color;
  // Fallback colors
  const colors = {
    'scheduled': '#2196f3',
    'completed': '#4caf50',
    'cancelled': '#f44336',
    'postponed': '#ff9800',
    'in-progress': '#9c27b0'
  };
  return colors[statusId] || '#757575';
};

export const MobileFilterDrawer = ({ 
  open, 
  onClose, 
  statusFilter, 
  setStatusFilter, 
  statusOptions = [],
  searchTerm = '',
  setSearchTerm,
  showUpcoming = true,
  setShowUpcoming,
  showPast = false,
  setShowPast,
  onClearFilters,
  totalResults = 0,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  // Local state for form values
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [localStatusFilter, setLocalStatusFilter] = useState(statusFilter);
  const [localShowUpcoming, setLocalShowUpcoming] = useState(showUpcoming);
  const [localShowPast, setLocalShowPast] = useState(showPast);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
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
      // Reset advanced section when drawer opens
      setIsAdvancedOpen(false);
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
    
    // Also clear parent state
    if (setSearchTerm) setSearchTerm('');
    if (setStatusFilter) setStatusFilter('all');
    if (setShowUpcoming) setShowUpcoming(true);
    if (setShowPast) setShowPast(false);
    
    if (onClearFilters) {
      onClearFilters();
    }
    onClose();
  }, [setSearchTerm, setStatusFilter, setShowUpcoming, setShowPast, onClearFilters, onClose]);

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

  // Get status label
  const getStatusLabel = (statusId) => {
    if (statusId === 'all') return 'All Statuses';
    const status = statusOptions.find(s => s.id === statusId || s.value === statusId);
    return status?.name || status?.label || statusId;
  };

  return (
    <SwipeableDrawer 
      anchor="bottom" 
      open={open} 
      onClose={onClose} 
      onOpen={() => {}}
      disableSwipeToOpen={false}
      PaperProps={{
        sx: {
          borderTopLeftRadius: isMobile ? 12 : 16,
          borderTopRightRadius: isMobile ? 12 : 16,
          maxHeight: isMobile ? '85vh' : '80vh',
          minHeight: isMobile ? '50vh' : '40vh',
          p: 0,
        }
      }}
    >
      {/* Drag Handle */}
      <Box 
        sx={{ 
          width: 40, 
          height: 4, 
          bgcolor: 'divider', 
          borderRadius: 2, 
          mx: 'auto', 
          mt: 1.5,
          mb: 1,
          cursor: 'pointer'
        }}
        onClick={onClose}
      />

      <Box sx={{ p: { xs: 2, sm: 3 }, pb: { xs: 4, sm: 4 } }}>
        {/* Header */}
        <Stack 
          direction="row" 
          justifyContent="space-between" 
          alignItems="center" 
          mb={2}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterAltIcon color="primary" sx={{ fontSize: isMobile ? 20 : 24 }} />
            <Typography variant="h6" fontWeight={700} fontSize={isMobile ? '1.1rem' : '1.25rem'}>
              Filters
              {activeFilterCount > 0 && (
                <Chip 
                  label={activeFilterCount} 
                  size="small" 
                  color="primary" 
                  sx={{ ml: 1, height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                />
              )}
            </Typography>
          </Stack>
          <IconButton 
            onClick={onClose} 
            edge="end"
            aria-label="Close filters"
            size={isMobile ? 'small' : 'medium'}
          >
            <Close />
          </IconButton>
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* Search Field - Optimized for mobile */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search meetings..."
          value={localSearchTerm}
          onChange={(e) => setLocalSearchTerm(e.target.value)}
          sx={{ mb: 2.5 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" sx={{ fontSize: isMobile ? 18 : 20 }} />
              </InputAdornment>
            ),
            endAdornment: localSearchTerm && (
              <InputAdornment position="end">
                <IconButton 
                  size="small" 
                  onClick={() => setLocalSearchTerm('')}
                  edge="end"
                >
                  <Close fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
            sx: { 
              borderRadius: 2,
              '& .MuiOutlinedInput-root': { borderRadius: 2 }
            }
          }}
        />

        {/* Status Filter - Compact */}
        <Stack spacing={1} sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" fontWeight={600} fontSize={isMobile ? '0.8rem' : '0.875rem'}>
            Status
          </Typography>
          <Stack 
            direction="row" 
            spacing={0.75} 
            flexWrap="wrap" 
            useFlexGap
            sx={{ gap: 0.75 }}
          >
            <Chip 
              label="All" 
              onClick={() => setLocalStatusFilter('all')} 
              color={localStatusFilter === 'all' ? 'primary' : 'default'}
              variant={localStatusFilter === 'all' ? 'filled' : 'outlined'}
              size="small"
              sx={{ 
                height: 28,
                fontSize: '0.7rem',
                fontWeight: localStatusFilter === 'all' ? 600 : 400,
                '& .MuiChip-label': { px: 1.5 }
              }}
            />
            {statusOptions.map(opt => {
              const isSelected = localStatusFilter === (opt.id || opt.value);
              const color = opt.color || getStatusColor(opt.id || opt.value, statusOptions);
              return (
                <Chip 
                  key={opt.id || opt.value}
                  label={opt.name || opt.label}
                  onClick={() => setLocalStatusFilter(opt.id || opt.value)}
                  size="small"
                  sx={{ 
                    height: 28,
                    fontSize: '0.7rem',
                    fontWeight: isSelected ? 600 : 400,
                    bgcolor: isSelected ? alpha(color, 0.15) : 'transparent',
                    borderColor: isSelected ? color : 'divider',
                    color: isSelected ? color : 'text.primary',
                    '&:hover': { 
                      bgcolor: alpha(color, 0.08),
                    },
                    '& .MuiChip-label': { px: 1.5 }
                  }}
                  variant={isSelected ? 'filled' : 'outlined'}
                />
              );
            })}
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        {/* Toggle Section - Simplified */}
        <Stack spacing={2} sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" fontWeight={600} fontSize={isMobile ? '0.8rem' : '0.875rem'}>
            Show Meetings
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <Chip
              icon={<EventIcon />}
              label="Upcoming"
              onClick={() => setLocalShowUpcoming(!localShowUpcoming)}
              color={localShowUpcoming ? 'primary' : 'default'}
              variant={localShowUpcoming ? 'filled' : 'outlined'}
              sx={{ 
                flex: 1,
                height: 32,
                fontSize: '0.75rem',
                fontWeight: localShowUpcoming ? 600 : 400,
              }}
            />
            <Chip
              icon={localShowPast ? <CheckCircleIcon /> : <Cancel />}
              label="Past"
              onClick={() => setLocalShowPast(!localShowPast)}
              color={localShowPast ? 'secondary' : 'default'}
              variant={localShowPast ? 'filled' : 'outlined'}
              sx={{ 
                flex: 1,
                height: 32,
                fontSize: '0.75rem',
                fontWeight: localShowPast ? 600 : 400,
              }}
            />
          </Stack>
        </Stack>

        {/* Optional: Show total results */}
        {totalResults > 0 && (
          <Box sx={{ 
            bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
            borderRadius: 2,
            p: 1,
            mb: 2.5,
            textAlign: 'center'
          }}>
            <Typography variant="body2" color="text.secondary">
              <strong>{totalResults}</strong> meeting{totalResults !== 1 ? 's' : ''} found
            </Typography>
          </Box>
        )}

        <Divider sx={{ mb: 2.5 }} />

        {/* Active Filters Summary */}
        {activeFilterCount > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Active Filters
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ gap: 0.5 }}>
              {searchTerm && (
                <Chip 
                  label={`🔍 ${searchTerm}`}
                  size="small"
                  onDelete={() => setLocalSearchTerm('')}
                  sx={{ height: 24, fontSize: '0.7rem' }}
                />
              )}
              {statusFilter !== 'all' && (
                <Chip 
                  label={`📌 ${getStatusLabel(statusFilter)}`}
                  size="small"
                  onDelete={() => setLocalStatusFilter('all')}
                  sx={{ height: 24, fontSize: '0.7rem' }}
                />
              )}
              {!showUpcoming && (
                <Chip 
                  label="⏰ No Upcoming"
                  size="small"
                  onDelete={() => setLocalShowUpcoming(true)}
                  sx={{ height: 24, fontSize: '0.7rem' }}
                />
              )}
              {showPast && (
                <Chip 
                  label="📅 Show Past"
                  size="small"
                  onDelete={() => setLocalShowPast(false)}
                  sx={{ height: 24, fontSize: '0.7rem' }}
                />
              )}
            </Stack>
          </Box>
        )}

        {/* Action Buttons - Sticky at bottom */}
        <Stack 
          direction="row" 
          spacing={1.5}
          sx={{ 
            position: 'sticky', 
            bottom: 0, 
            bgcolor: 'background.paper',
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            mx: -2,
            px: 2,
            pb: 0,
          }}
        >
          <Button 
            variant="outlined" 
            onClick={handleClear}
            startIcon={<ClearAllIcon />}
            disabled={activeFilterCount === 0}
            sx={{ 
              flex: 1,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.8rem',
              py: 1.2,
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'error.main',
                color: 'error.main'
              }
            }}
          >
            Clear All
          </Button>
          <Button 
            variant="contained" 
            onClick={handleApply}
            disabled={!hasChanges}
            sx={{ 
              flex: 2,
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              fontSize: '0.8rem',
              py: 1.2,
              boxShadow: theme.shadows[2],
              '&:hover': {
                boxShadow: theme.shadows[4],
              }
            }}
          >
            Apply Filters
          </Button>
        </Stack>
      </Box>
    </SwipeableDrawer>
  );
};

// Display name for debugging
MobileFilterDrawer.displayName = 'MobileFilterDrawer';

// Default export
export default MobileFilterDrawer;