// src/components/meetings/MeetingForm/components/DepartmentSelector.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
  Box,
  FormHelperText,
  CircularProgress,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Divider,
  Popover,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Button,
  Alert
} from '@mui/material';
import {
  Domain as DepartmentIcon,
  Search as SearchIcon,
  Close as Close,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../../../../../services/api';

// Custom hook for debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
};

export const DepartmentSelector = ({ value, onChange, disabled, required = false }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch user's departments
  const fetchUserDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/auth/me/departments', {
        params: { limit: 100, active_only: true }
      });
      
      // Handle response structure
      let departmentsData = [];
      if (response.data?.success === true && Array.isArray(response.data.data)) {
        departmentsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        departmentsData = response.data;
      } else if (response.data?.items) {
        departmentsData = response.data.items;
      }
      
      // Transform data - remove path from being stored
      const transformedDepartments = departmentsData.map(dept => ({
        id: dept.department_id || dept.id,
        name: dept.department_name || dept.name,
        code: dept.code || dept.department_code || '',
        description: dept.description || '',
        role: dept.role || 'member',
        status: dept.status || 'active',
        is_primary: dept.is_primary || false,
        user_id: dept.user_id,
        assignment_id: dept.id
      }));
      
      setDepartments(transformedDepartments);
      
      if (transformedDepartments.length === 0) {
        setError('No departments assigned to your account. Please contact your administrator.');
      }
      
    } catch (error) {
      console.error('Error fetching departments:', error);
      setError('Unable to load your departments. Please refresh or contact support.');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load departments on mount
  useEffect(() => {
    fetchUserDepartments();
  }, [fetchUserDepartments]);

  // Filter departments based on search term
  const filteredDepartments = useMemo(() => {
    if (!debouncedSearchTerm) return departments;
    
    const term = debouncedSearchTerm.toLowerCase();
    return departments.filter(dept =>
      dept.name?.toLowerCase().includes(term) ||
      dept.code?.toLowerCase().includes(term)
    );
  }, [departments, debouncedSearchTerm]);

  // Handle department selection
  const handleChange = useCallback((selectedValue) => {
    onChange(selectedValue);
    setSearchTerm('');
    setPopoverAnchor(null);
  }, [onChange]);

  // Handle clear selection
  const handleClear = useCallback(() => {
    onChange('');
    setSearchTerm('');
  }, [onChange]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchUserDepartments();
  }, [fetchUserDepartments]);

  // Get role badge color
  const getRoleColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'head': return 'error';
      case 'manager': return 'warning';
      case 'supervisor': return 'info';
      case 'member': return 'default';
      default: return 'default';
    }
  };

  // Get role label
  const getRoleLabel = (role) => {
    switch (role?.toLowerCase()) {
      case 'head': return 'Dept Head';
      case 'manager': return 'Manager';
      case 'supervisor': return 'Supervisor';
      case 'member': return 'Member';
      default: return role || 'Member';
    }
  };

  // Custom Select renderer - ONLY shows name, never ID or path
  const renderValue = useCallback(() => {
    if (!value) return '';
    const dept = departments.find(d => d.id === value);
    if (!dept) return '';
    
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        <DepartmentIcon fontSize="small" sx={{ color: '#FF9800' }} />
        <Typography variant="body2">{dept.name}</Typography>
        {dept.role && (
          <Chip 
            label={getRoleLabel(dept.role)} 
            size="small" 
            color={getRoleColor(dept.role)}
            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
          />
        )}
      </Stack>
    );
  }, [value, departments]);

  // Handle popover open/close
  const handleOpenPopover = (event) => {
    if (!disabled) {
      setPopoverAnchor(event.currentTarget);
    }
  };

  const handleClosePopover = () => {
    setPopoverAnchor(null);
    setSearchTerm('');
  };

  const isOpen = Boolean(popoverAnchor);

  // If no departments and not loading, show message
  if (!loading && departments.length === 0 && !error) {
    return (
      <FormControl fullWidth disabled={disabled}>
        <InputLabel>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DepartmentIcon fontSize="small" />
            <span>Department {required && '*'}</span>
          </Stack>
        </InputLabel>
        <Select
          value=""
          disabled
          label="Department *"
          renderValue={() => ''}
        >
          <MenuItem disabled>No departments available</MenuItem>
        </Select>
        <FormHelperText>No departments assigned to your account</FormHelperText>
      </FormControl>
    );
  }

  return (
    <>
      <FormControl fullWidth disabled={disabled} required={required}>
        <InputLabel>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DepartmentIcon fontSize="small" />
            <span>Department {required && '*'}</span>
          </Stack>
        </InputLabel>
        
        <Select
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          label="Department *"
          renderValue={renderValue}
          onClick={handleOpenPopover}
          IconComponent={() => null}
          endAdornment={
            value && !disabled ? (
              <Close 
                fontSize="small" 
                sx={{ 
                  mr: 1, 
                  cursor: 'pointer',
                  opacity: 0.7,
                  '&:hover': { opacity: 1 }
                }} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
              />
            ) : null
          }
          MenuProps={{ open: false }}
        />
        
        <FormHelperText>
          {departments.length === 0 && !loading && !error
            ? "No departments found"
            : "Select the department this meeting belongs to"}
        </FormHelperText>
      </FormControl>

      {/* Custom Popover Menu with Search */}
      <Popover
        open={isOpen}
        anchorEl={popoverAnchor}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            width: popoverAnchor?.clientWidth || 400,
            maxHeight: 400,
            p: 0,
            mt: 1,
            borderRadius: 2
          }
        }}
      >
        <Stack spacing={1} sx={{ p: 2 }}>
          {/* Search Input */}
          <TextField
            size="small"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: loading && (
                  <InputAdornment position="end">
                    <CircularProgress size={16} />
                  </InputAdornment>
                )
              }
            }}
          />

          {/* Loading State */}
          {loading && (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={30} />
              <Typography variant="caption" sx={{ mt: 1 }}>
                Loading your departments...
              </Typography>
            </Stack>
          )}

          {/* Error State */}
          {error && !loading && (
            <Alert 
              severity="error" 
              action={
                <Button color="inherit" size="small" onClick={handleRefresh} startIcon={<RefreshIcon />}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {/* No Results */}
          {!loading && !error && filteredDepartments.length === 0 && (
            <Alert severity="info">
              {searchTerm 
                ? `No departments matching "${searchTerm}"` 
                : "You don't have any departments assigned yet."}
            </Alert>
          )}

          {/* Departments List - No path displayed */}
          {!loading && !error && filteredDepartments.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <List dense disablePadding>
                {filteredDepartments.map((dept) => (
                  <ListItemButton
                    key={dept.id}
                    selected={value === dept.id}
                    onClick={() => handleChange(dept.id)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.light', width: 32, height: 32 }}>
                        <DepartmentIcon fontSize="small" />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" fontWeight={value === dept.id ? 600 : 400}>
                            {dept.name}
                          </Typography>
                          {dept.code && (
                            <Chip 
                              label={dept.code} 
                              size="small" 
                              variant="outlined" 
                              sx={{ height: 20, fontSize: '0.65rem' }}
                            />
                          )}
                          <Chip 
                            label={getRoleLabel(dept.role)} 
                            size="small" 
                            color={getRoleColor(dept.role)}
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        </Stack>
                      }
                    />
                    {value === dept.id && (
                      <CheckCircleIcon color="primary" fontSize="small" />
                    )}
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          )}

          {/* Summary */}
          {!loading && !error && filteredDepartments.length > 0 && (
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Showing {filteredDepartments.length} of {departments.length} departments
              </Typography>
              {value && (
                <Button size="small" onClick={handleClear} startIcon={<Close />}>
                  Clear
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </Popover>
    </>
  );
};

export default DepartmentSelector;