// src/components/address/LocationForm.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Box,
  Alert,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Divider,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Breadcrumbs,
  Link,
  Tooltip,
  Autocomplete,
  InputAdornment
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  LocationOn as LocationIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Map as MapIcon,
  Home as HomeIcon,
  Business as BusinessIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import api from '../../services/api';

// ==================== Constants ====================

const LEVELS = [
  { level: 1, type: 'country', name: 'Country', icon: <PublicIcon />, placeholder: 'e.g., Uganda' },
  { level: 2, type: 'region', name: 'Region', icon: <FlagIcon />, placeholder: 'e.g., Central Region' },
  { level: 3, type: 'district', name: 'District', icon: <TerrainIcon />, placeholder: 'e.g., Kampala' },
  { level: 4, type: 'county', name: 'County', icon: <BusinessIcon />, placeholder: 'e.g., Kampala Central' },
  { level: 5, type: 'subcounty', name: 'Subcounty', icon: <HomeIcon />, placeholder: 'e.g., Central Division' },
  { level: 6, type: 'parish', name: 'Parish', icon: <LocationIcon />, placeholder: 'e.g., Nakasero' },
  { level: 7, type: 'village', name: 'Village', icon: <HomeIcon />, placeholder: 'e.g., Nakasero I' },
];

const LEVEL_MAP = {
  1: 'country',
  2: 'region',
  3: 'district',
  4: 'county',
  5: 'subcounty',
  6: 'parish',
  7: 'village'
};

// ==================== Helper Functions ====================

const getLevelIcon = (level) => {
  const levelData = LEVELS.find(l => l.level === level);
  return levelData?.icon || <LocationIcon />;
};

const getLevelName = (level) => {
  const levelData = LEVELS.find(l => l.level === level);
  return levelData?.name || `Level ${level}`;
};

// ==================== Location Hierarchy Component ====================

const LocationHierarchy = ({ ancestors = [], onSelect, onClear }) => {
  if (!ancestors || ancestors.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No parent location selected. This will be a top-level location.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Location Hierarchy
      </Typography>
      <Breadcrumbs separator="›" aria-label="location hierarchy">
        {ancestors.map((ancestor, index) => (
          <Link
            key={ancestor.id}
            component="button"
            variant="body2"
            onClick={() => onSelect?.(ancestor)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
          >
            {getLevelIcon(ancestor.level)}
            {ancestor.name}
          </Link>
        ))}
      </Breadcrumbs>
      {onClear && ancestors.length > 0 && (
        <Button size="small" onClick={onClear} sx={{ mt: 1 }}>
          Clear parent
        </Button>
      )}
    </Box>
  );
};

// ==================== Parent Selector Component ====================

const ParentSelector = ({ level, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const parentLevel = level - 1;
  const parentLevelInfo = LEVELS.find(l => l.level === parentLevel);

  const fetchParents = useCallback(async () => {
    if (!parentLevelInfo) return;
    
    setLoading(true);
    try {
      const response = await api.get('/locations/', {
        params: {
          level: parentLevel,
          limit: 50,
          ...(searchTerm && { search: searchTerm })
        }
      });
      setOptions(response.data?.items || response.data || []);
    } catch (error) {
      console.error('Failed to fetch parent locations:', error);
    } finally {
      setLoading(false);
    }
  }, [parentLevel, parentLevelInfo, searchTerm]);

  useEffect(() => {
    if (open) {
      fetchParents();
    }
  }, [open, fetchParents]);

  if (!parentLevelInfo) {
    return (
      <Alert severity="info">
        This is a top-level location (Country). No parent selection needed.
      </Alert>
    );
  }

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      value={value}
      onChange={(event, newValue) => onChange(newValue)}
      options={options}
      loading={loading}
      getOptionLabel={(option) => `${option.name} (${option.code})`}
      isOptionEqualToValue={(option, val) => option.id === val?.id}
      renderOption={(props, option) => (
        <li {...props}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {getLevelIcon(parentLevel)}
            <Typography variant="body2">{option.name}</Typography>
            <Chip label={option.code} size="small" variant="outlined" />
          </Stack>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={`Parent ${parentLevelInfo.name}`}
          placeholder={`Search for ${parentLevelInfo.name}...`}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <InputAdornment position="start">
                  {getLevelIcon(parentLevel)}
                </InputAdornment>
                {params.InputProps.startAdornment}
              </>
            ),
            endAdornment: (
              <>
                {loading ? <CircularProgress size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          helperText={`Select the parent ${parentLevelInfo.name} for this location`}
          disabled={disabled}
        />
      )}
    />
  );
};

// ==================== Location Preview Component ====================

const LocationPreview = ({ formData, ancestors }) => {
  const levelInfo = LEVELS.find(l => l.level === formData.level);
  
  if (!formData.name && !formData.code) {
    return null;
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f0fdf4', borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        {levelInfo?.icon}
        <Typography variant="subtitle2" fontWeight={600}>
          Location Preview
        </Typography>
      </Stack>
      
      <Stack spacing={1}>
        <Box>
          <Typography variant="caption" color="text.secondary">Full Hierarchy</Typography>
          <Typography variant="body2">
            {ancestors.length > 0 ? (
              <Breadcrumbs separator=" › " maxItems={3}>
                {ancestors.map(a => (
                  <span key={a.id}>{a.name}</span>
                ))}
                <strong>{formData.name || 'New Location'}</strong>
              </Breadcrumbs>
            ) : (
              <strong>{formData.name || 'New Location'}</strong>
            )}
          </Typography>
        </Box>
        
        <Box>
          <Typography variant="caption" color="text.secondary">Location Code</Typography>
          <Typography variant="body2" fontFamily="monospace">
            {formData.code || 'Will be auto-generated'}
          </Typography>
        </Box>
        
        <Box>
          <Typography variant="caption" color="text.secondary">Type</Typography>
          <Chip 
            label={levelInfo?.name || `Level ${formData.level}`} 
            size="small" 
            color="primary" 
            variant="outlined"
          />
        </Box>
      </Stack>
    </Paper>
  );
};

// ==================== Main Location Form Component ====================

const LocationForm = ({ open, onClose, onSuccess, initialData, mode = 'create' }) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    short_name: '',
    native_name: '',
    full_name: '',
    level: 1,
    location_type: '',
    parent_id: null,
    status: 'active',
    latitude: '',
    longitude: '',
    population: '',
    area: '',
    postal_code: '',
    extra_metadata: {}
  });
  
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [availableLevels, setAvailableLevels] = useState([]);

  const isEdit = mode === 'edit';
  const levelInfo = LEVELS.find(l => l.level === formData.level);

  // Fetch available levels based on parent
  const fetchAvailableLevels = useCallback(async () => {
    if (!formData.parent_id) {
      setAvailableLevels(LEVELS);
      return;
    }
    
    try {
      const response = await api.get(`/locations/${formData.parent_id}`);
      const parent = response.data;
      const nextLevel = parent.level + 1;
      const available = LEVELS.filter(l => l.level === nextLevel);
      setAvailableLevels(available);
      
      if (formData.level !== nextLevel) {
        setFormData(prev => ({ ...prev, level: nextLevel }));
      }
    } catch (error) {
      console.error('Failed to fetch parent info:', error);
      setAvailableLevels(LEVELS);
    }
  }, [formData.parent_id]);

  // Fetch ancestors when parent changes
  const fetchAncestors = useCallback(async () => {
    if (!formData.parent_id) {
      setAncestors([]);
      return;
    }
    
    try {
      const response = await api.get(`/locations/${formData.parent_id}/ancestors`);
      const ancestorsList = response.data || [];
      setAncestors(ancestorsList);
    } catch (error) {
      console.error('Failed to fetch ancestors:', error);
      setAncestors([]);
    }
  }, [formData.parent_id]);

  // Validate code uniqueness
  const validateCode = useCallback(async (code) => {
    if (!code || code.length < 3) {
      setCodeAvailable(null);
      return;
    }
    
    setCodeValidating(true);
    try {
      const response = await api.get(`/locations/by-code/${code}`);
      const exists = response.data;
      setCodeAvailable(!exists);
    } catch (error) {
      if (error.response?.status === 404) {
        setCodeAvailable(true);
      } else {
        setCodeAvailable(false);
      }
    } finally {
      setCodeValidating(false);
    }
  }, []);

  // Load initial data for edit mode
  useEffect(() => {
    if (open && initialData && isEdit) {
      setFormData({
        code: initialData.code || '',
        name: initialData.name || '',
        short_name: initialData.short_name || '',
        native_name: initialData.native_name || '',
        full_name: initialData.full_name || '',
        level: initialData.level || 1,
        location_type: initialData.location_type || '',
        parent_id: initialData.parent_id || null,
        status: initialData.status || 'active',
        latitude: initialData.latitude || '',
        longitude: initialData.longitude || '',
        population: initialData.population || '',
        area: initialData.area || '',
        postal_code: initialData.postal_code || '',
        extra_metadata: initialData.extra_metadata || {}
      });
      setAvailableLevels(LEVELS.filter(l => l.level === (initialData.level || 1)));
    }
  }, [open, initialData, isEdit]);

  // Fetch ancestors when parent changes
  useEffect(() => {
    if (open) {
      fetchAncestors();
      fetchAvailableLevels();
    }
  }, [open, formData.parent_id, fetchAncestors, fetchAvailableLevels]);

  // Validate code on change
  useEffect(() => {
    if (!isEdit && formData.code) {
      const timer = setTimeout(() => validateCode(formData.code), 500);
      return () => clearTimeout(timer);
    }
  }, [formData.code, isEdit, validateCode]);

  const handleChange = (field) => (event) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleParentChange = (parent) => {
    setFormData(prev => ({ 
      ...prev, 
      parent_id: parent?.id || null,
      level: parent ? parent.level + 1 : 1
    }));
  };

  const handleLevelChange = (event) => {
    const newLevel = parseInt(event.target.value);
    setFormData(prev => ({ ...prev, level: newLevel }));
    
    // Clear parent if level is 1 (country)
    if (newLevel === 1) {
      setFormData(prev => ({ ...prev, parent_id: null }));
    }
  };

  const handleClearParent = () => {
    setFormData(prev => ({ ...prev, parent_id: null, level: 1 }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name) {
      setError('Location name is required');
      return;
    }
    
    if (!formData.code) {
      setError('Location code is required');
      return;
    }
    
    if (codeAvailable === false && !isEdit) {
      setError('Location code already exists. Please use a different code.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const payload = {
        code: formData.code,
        name: formData.name,
        short_name: formData.short_name || null,
        native_name: formData.native_name || null,
        full_name: formData.full_name || null,
        level: formData.level,
        location_type: LEVEL_MAP[formData.level],
        parent_id: formData.parent_id || null,
        status: formData.status,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        population: formData.population ? parseInt(formData.population) : null,
        area: formData.area ? parseFloat(formData.area) : null,
        postal_code: formData.postal_code || null,
      };
      
      let response;
      if (isEdit && initialData?.id) {
        response = await api.put(`/locations/${initialData.id}`, payload);
      } else {
        response = await api.post('/locations/', payload);
      }
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.(response.data);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to save location:', err);
      setError(err.response?.data?.detail || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      label: 'Basic Information',
      description: 'Name and code for the location',
      fields: ['name', 'code', 'short_name', 'native_name', 'full_name']
    },
    {
      label: 'Hierarchy',
      description: 'Parent location and level',
      fields: ['level', 'parent_id']
    },
    {
      label: 'Geographic Data',
      description: 'GPS coordinates and demographics',
      fields: ['latitude', 'longitude', 'population', 'area']
    },
    {
      label: 'Additional Info',
      description: 'Postal code and metadata',
      fields: ['postal_code', 'status']
    }
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <LocationIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              {isEdit ? 'Edit Location' : 'Create New Location'}
            </Typography>
            {levelInfo && (
              <Chip 
                label={levelInfo.name} 
                size="small" 
                color="primary" 
                icon={levelInfo.icon}
              />
            )}
          </Stack>
          <IconButton onClick={onClose} size="small" disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Location {isEdit ? 'updated' : 'created'} successfully!
          </Alert>
        )}
        
        {/* Location Hierarchy Preview */}
        {ancestors.length > 0 && (
          <LocationHierarchy 
            ancestors={ancestors} 
            onSelect={handleParentChange}
            onClear={handleClearParent}
          />
        )}
        
        <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 2 }}>
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel StepIconComponent={step.icon}>
                <Typography variant="subtitle2">{step.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {step.description}
                </Typography>
              </StepLabel>
              <StepContent>
                <Stack spacing={2} sx={{ mt: 1, mb: 2 }}>
                  {/* Step 1: Basic Information */}
                  {index === 0 && (
                    <>
                      <TextField
                        fullWidth
                        label="Location Name *"
                        value={formData.name}
                        onChange={handleChange('name')}
                        placeholder={levelInfo?.placeholder}
                        required
                        disabled={loading}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              {levelInfo?.icon}
                            </InputAdornment>
                          ),
                        }}
                      />
                      
                      <TextField
                        fullWidth
                        label="Location Code *"
                        value={formData.code}
                        onChange={handleChange('code')}
                        placeholder="e.g., UG-1-001"
                        required
                        disabled={loading || isEdit}
                        error={codeAvailable === false && !isEdit}
                        helperText={
                          codeAvailable === false && !isEdit
                            ? 'Code already exists'
                            : codeValidating
                            ? 'Checking availability...'
                            : 'Unique identifier for this location'
                        }
                        InputProps={{
                          endAdornment: codeValidating && (
                            <InputAdornment position="end">
                              <CircularProgress size={20} />
                            </InputAdornment>
                          ),
                        }}
                      />
                      
                      <TextField
                        fullWidth
                        label="Short Name"
                        value={formData.short_name}
                        onChange={handleChange('short_name')}
                        placeholder="Abbreviated name"
                        disabled={loading}
                      />
                      
                      <TextField
                        fullWidth
                        label="Native Name"
                        value={formData.native_name}
                        onChange={handleChange('native_name')}
                        placeholder="Name in local language"
                        disabled={loading}
                      />
                      
                      <TextField
                        fullWidth
                        label="Full Name"
                        value={formData.full_name}
                        onChange={handleChange('full_name')}
                        placeholder="Complete official name"
                        disabled={loading}
                      />
                    </>
                  )}
                  
                  {/* Step 2: Hierarchy */}
                  {index === 1 && (
                    <>
                      <FormControl fullWidth disabled={loading}>
                        <InputLabel>Location Level</InputLabel>
                        <Select
                          value={formData.level}
                          label="Location Level"
                          onChange={handleLevelChange}
                        >
                          {availableLevels.map((level) => (
                            <MenuItem key={level.level} value={level.level}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                {level.icon}
                                <Typography>{level.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  (Level {level.level})
                                </Typography>
                              </Stack>
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {formData.level === 1 
                            ? 'Country level - top of hierarchy' 
                            : `Level ${formData.level} - ${levelInfo?.name}`}
                        </FormHelperText>
                      </FormControl>
                      
                      {formData.level > 1 && (
                        <ParentSelector
                          level={formData.level}
                          value={formData.parent_id ? { id: formData.parent_id } : null}
                          onChange={handleParentChange}
                          disabled={loading}
                        />
                      )}
                    </>
                  )}
                  
                  {/* Step 3: Geographic Data */}
                  {index === 2 && (
                    <>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            label="Latitude"
                            type="number"
                            value={formData.latitude}
                            onChange={handleChange('latitude')}
                            placeholder="-90 to 90"
                            disabled={loading}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <MapIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            label="Longitude"
                            type="number"
                            value={formData.longitude}
                            onChange={handleChange('longitude')}
                            placeholder="-180 to 180"
                            disabled={loading}
                          />
                        </Grid>
                      </Grid>
                      
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            label="Population"
                            type="number"
                            value={formData.population}
                            onChange={handleChange('population')}
                            placeholder="Estimated population"
                            disabled={loading}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            label="Area (sq km)"
                            type="number"
                            value={formData.area}
                            onChange={handleChange('area')}
                            placeholder="Area in square kilometers"
                            disabled={loading}
                          />
                        </Grid>
                      </Grid>
                    </>
                  )}
                  
                  {/* Step 4: Additional Info */}
                  {index === 3 && (
                    <>
                      <TextField
                        fullWidth
                        label="Postal Code"
                        value={formData.postal_code}
                        onChange={handleChange('postal_code')}
                        placeholder="ZIP/Postal code"
                        disabled={loading}
                      />
                      
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={formData.status}
                          label="Status"
                          onChange={handleChange('status')}
                          disabled={loading}
                        >
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="inactive">Inactive</MenuItem>
                          <MenuItem value="archived">Archived</MenuItem>
                        </Select>
                        <FormHelperText>
                          Active locations are visible in the system
                        </FormHelperText>
                      </FormControl>
                    </>
                  )}
                </Stack>
                
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setActiveStep(prev => prev - 1)}
                    disabled={activeStep === 0}
                    startIcon={<ArrowBackIcon />}
                  >
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => {
                      if (activeStep === steps.length - 1) {
                        handleSubmit();
                      } else {
                        setActiveStep(prev => prev + 1);
                      }
                    }}
                    disabled={loading}
                    endIcon={activeStep === steps.length - 1 ? <SaveIcon /> : <ArrowForwardIcon />}
                  >
                    {activeStep === steps.length - 1 
                      ? (loading ? 'Saving...' : (isEdit ? 'Update' : 'Create')) 
                      : 'Next'}
                  </Button>
                </Stack>
              </StepContent>
            </Step>
          ))}
        </Stepper>
        
        {/* Location Preview */}
        {(formData.name || formData.code) && (
          <LocationPreview formData={formData} ancestors={ancestors} />
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5, justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !formData.name || !formData.code || codeAvailable === false}
          startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {loading ? 'Saving...' : (isEdit ? 'Update Location' : 'Create Location')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LocationForm;