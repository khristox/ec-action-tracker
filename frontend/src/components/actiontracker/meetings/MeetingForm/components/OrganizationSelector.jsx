// src/components/meetings/MeetingForm/components/OrganizationSelector.jsx
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
  Alert,
  Chip,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Popover,
  Button
} from '@mui/material';
import {
  Business as OrgIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon
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

export const OrganizationSelector = ({ value, onChange, disabled, required = true }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch user's departments from the correct endpoint
  const fetchUserDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/auth/me/departments', {
        params: { limit: 100, active_only: true }
      });
      
      console.log('API Response:', response.data);
      
      let userDepartments = [];
      
      if (response.data && response.data.success === true && Array.isArray(response.data.data)) {
        userDepartments = response.data.data;
      } else if (Array.isArray(response.data)) {
        userDepartments = response.data;
      } else if (response.data && Array.isArray(response.data.items)) {
        userDepartments = response.data.items;
      } else if (response.data && Array.isArray(response.data.data)) {
        userDepartments = response.data.data;
      }
      
      console.log('Processed departments:', userDepartments);
      setDepartments(userDepartments);
      
      if (userDepartments.length === 0) {
        setError('No departments assigned to your account. Please contact your administrator.');
      }
      
    } catch (error) {
      console.error('Error fetching user departments:', error);
      
      if (error.response?.status === 404) {
        setError('Departments endpoint not found. Please contact support.');
      } else if (error.response?.status === 401) {
        setError('Please log in again to access your departments.');
      } else {
        setError('Unable to load your departments. Please refresh or contact support.');
      }
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
      dept.department_name?.toLowerCase().includes(term) ||
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

  // Get department details
  const getDepartmentId = (dept) => dept.department_id || dept.id;
  const getDepartmentName = (dept) => dept.department_name || dept.name || '';
  const getDepartmentCode = (dept) => dept.code || dept.department_code || '';

  const selectedDept = useMemo(() => {
    return departments.find(d => getDepartmentId(d) === value);
  }, [departments, value]);

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

  return (
    <>
      {/* Main FormControl - This was missing! */}
      <FormControl fullWidth disabled={disabled} required={required} onClick={handleOpenPopover}>
        <InputLabel>
          <Stack direction="row" alignItems="center" spacing={1}>
            <OrgIcon fontSize="small" />
            <span>Department *</span>
          </Stack>
        </InputLabel>
        
        <Select
          value={value || ''}
          onChange={() => {}} // Empty onChange, popover handles selection
          label="Department *"
          renderValue={(selected) => {
            const dept = departments.find(d => getDepartmentId(d) === selected);
            if (!dept) return '';
            return (
              <Stack direction="row" alignItems="center" spacing={1}>
                <OrgIcon fontSize="small" sx={{ color: '#2196F3' }} />
                <Typography variant="body2">{getDepartmentName(dept)}</Typography>
                {getDepartmentCode(dept) && (
                  <Chip 
                    label={getDepartmentCode(dept)} 
                    size="small" 
                    variant="outlined" 
                    sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Stack>
            );
          }}
          MenuProps={{ open: false }} // Disable default menu
          endAdornment={
            value && !disabled ? (
              <CloseIcon 
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

          {/* Departments List */}
          {!loading && !error && filteredDepartments.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <List dense disablePadding>
                {filteredDepartments.map((dept, index) => {
                  const deptId = getDepartmentId(dept);
                  const deptName = getDepartmentName(dept);
                  const deptCode = getDepartmentCode(dept);
                  const isSelected = value === deptId;
                  
                  return (
                    <ListItemButton
                      key={deptId}
                      selected={isSelected}
                      onClick={() => handleChange(deptId)}
                      divider={index < filteredDepartments.length - 1}
                      sx={{
                        borderRadius: 0,
                        '&.Mui-selected': {
                          bgcolor: 'primary.light',
                          '&:hover': { bgcolor: 'primary.main' }
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.light', width: 32, height: 32 }}>
                          <OrgIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                              {deptName}
                            </Typography>
                            {deptCode && (
                              <Chip 
                                label={deptCode} 
                                size="small" 
                                variant="outlined" 
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            )}
                          </Stack>
                        }
                        secondary={
                          dept.department_type && (
                            <Typography variant="caption" color="text.secondary">
                              Type: {dept.department_type}
                            </Typography>
                          )
                        }
                      />
                      {isSelected && (
                        <CheckCircleIcon color="primary" fontSize="small" />
                      )}
                    </ListItemButton>
                  );
                })}
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
                <Button size="small" onClick={handleClear} startIcon={<CloseIcon />}>
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

export default OrganizationSelector;