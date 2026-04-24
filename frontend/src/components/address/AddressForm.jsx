// src/components/address/AddressForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
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
  Divider,
  Paper,
  Autocomplete,
  InputAdornment,
  useTheme,
  alpha,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  LocationOn as LocationIcon,
  AddLocation as AddLocationIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  AddCircle as AddCircleIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import api from '../../services/api';

const ADDRESS_LEVELS = [
  { level: 1, name: 'Country', type: 'country', icon: <PublicIcon />, color: '#4CAF50', darkColor: '#81C784', label: 'Select or Create Country' },
  { level: 2, name: 'Region', type: 'region', icon: <FlagIcon />, color: '#2196F3', darkColor: '#64B5F6', label: 'Select or Create Region' },
  { level: 3, name: 'District', type: 'district', icon: <TerrainIcon />, color: '#9C27B0', darkColor: '#CE93D8', label: 'Select or Create District' },
  { level: 4, name: 'County', type: 'county', icon: <BusinessIcon />, color: '#FF9800', darkColor: '#FFB74D', label: 'Select or Create County' },
  { level: 5, name: 'Subcounty', type: 'subcounty', icon: <HomeIcon />, color: '#795548', darkColor: '#A1887F', label: 'Select or Create Subcounty' },
  { level: 6, name: 'Parish', type: 'parish', icon: <LocationIcon />, color: '#607D8B', darkColor: '#90A4AE', label: 'Select or Create Parish' },
  { level: 7, name: 'Village', type: 'village', icon: <HomeIcon />, color: '#8BC34A', darkColor: '#AED581', label: 'Select or Create Village' }
];

const MAX_LEVEL = 7;

const AddressForm = ({ open, onClose, onSuccess, initialData, mode = 'create' }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  // Hierarchy state
  const [hierarchy, setHierarchy] = useState({});
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState({});
  const [stopLevel, setStopLevel] = useState(null);
  
  // Form state
  const [currentFormData, setCurrentFormData] = useState({
    code: '',
    name: '',
    short_name: '',
    native_name: '',
    full_name: '',
    latitude: '',
    longitude: '',
    population: '',
    area: '',
    postal_code: ''
  });
  
  const [selectedExisting, setSelectedExisting] = useState(null);
  const [parentOptions, setParentOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingParents, setLoadingParents] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState(null);
  const [createMode, setCreateMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  
  const isEdit = mode === 'edit';
  const currentLevel = ADDRESS_LEVELS[activeStep];
  const nextLevel = ADDRESS_LEVELS[activeStep + 1];
  
  // Load options for current level
  const loadOptions = useCallback(async () => {
    setLoadingParents(true);
    try {
      let params = {
        location_mode: 'address',
        limit: 100,
        include_inactive: false
      };
      
      if (activeStep === 0) {
        // Level 1: load top-level locations (countries)
        params.level = 1;
      } else if (hierarchy[activeStep - 1]?.id) {
        // Load children of selected parent
        params.parent_id = hierarchy[activeStep - 1].id;
      } else {
        setParentOptions([]);
        setLoadingParents(false);
        return;
      }
      
      const response = await api.get('/locations/', { params });
      setParentOptions(response.data?.items || []);
    } catch (err) {
      console.error('Error loading options:', err);
      setParentOptions([]);
    } finally {
      setLoadingParents(false);
    }
  }, [activeStep, hierarchy]);
  
  // Load existing hierarchy when editing
  useEffect(() => {
    if (open && isEdit && initialData) {
      const loadHierarchy = async () => {
        setLoading(true);
        try {
          if (initialData.parent_id) {
            const response = await api.get(`/locations/${initialData.parent_id}/ancestors`);
            const ancestors = response.data || [];
            const newHierarchy = {};
            
            ancestors.forEach((ancestor) => {
              const levelInfo = ADDRESS_LEVELS.find(l => l.level === ancestor.level);
              if (levelInfo) {
                newHierarchy[levelInfo.level - 1] = ancestor;
              }
            });
            
            newHierarchy[initialData.level - 1] = initialData;
            setHierarchy(newHierarchy);
            setStopLevel(initialData.level - 1);
            setActiveStep(initialData.level);
          } else {
            setHierarchy({ [initialData.level - 1]: initialData });
            setStopLevel(initialData.level - 1);
            setActiveStep(initialData.level);
          }
          setCreateMode(true);
        } catch (err) {
          console.error('Error loading hierarchy:', err);
        } finally {
          setLoading(false);
        }
      };
      loadHierarchy();
    }
  }, [open, isEdit, initialData]);
  
  // Load options when step changes
  useEffect(() => {
    if (open && !isEdit && !createMode && !editMode) {
      loadOptions();
    }
  }, [activeStep, open, isEdit, createMode, editMode, loadOptions]);
  
  // Reset form when opening
  useEffect(() => {
    if (open && !isEdit && !createMode && !editMode) {
      setHierarchy({});
      setActiveStep(0);
      setCompletedSteps({});
      setStopLevel(null);
      setCreateMode(false);
      setEditMode(false);
      setEditingLevel(null);
      setCurrentFormData({
        code: '',
        name: '',
        short_name: '',
        native_name: '',
        full_name: '',
        latitude: '',
        longitude: '',
        population: '',
        area: '',
        postal_code: ''
      });
      setSelectedExisting(null);
      setError(null);
      setSuccess(false);
      setCodeAvailable(null);
    }
  }, [open, isEdit, createMode, editMode]);
  
  // Handle selecting an existing location
  const handleSelectExisting = (event, value) => {
    setSelectedExisting(value);
  };
  
  // Handle continuing with selected existing location
  const handleContinueWithExisting = () => {
    if (selectedExisting) {
      const newHierarchy = { ...hierarchy, [activeStep]: selectedExisting };
      setHierarchy(newHierarchy);
      setCompletedSteps(prev => ({ ...prev, [activeStep]: true }));
      
      if (activeStep + 1 < MAX_LEVEL) {
        setActiveStep(activeStep + 1);
        setSelectedExisting(null);
      } else {
        setStopLevel(activeStep);
        setCreateMode(true);
      }
    }
  };
  
  // Handle creating a new location
  const handleCreateNew = () => {
    setCreateMode(true);
    setEditMode(false);
    setEditingLevel(null);
    setCurrentFormData({
      code: '',
      name: '',
      short_name: '',
      native_name: '',
      full_name: '',
      latitude: '',
      longitude: '',
      population: '',
      area: '',
      postal_code: ''
    });
    setCodeAvailable(null);
  };
  
  // Handle editing an existing level
  const handleEditLevel = (levelIndex) => {
    const levelData = hierarchy[levelIndex];
    if (levelData) {
      setCurrentFormData({
        code: levelData.code || '',
        name: levelData.name || '',
        short_name: levelData.short_name || '',
        native_name: levelData.native_name || '',
        full_name: levelData.full_name || '',
        latitude: levelData.latitude || '',
        longitude: levelData.longitude || '',
        population: levelData.population || '',
        area: levelData.area || '',
        postal_code: levelData.postal_code || ''
      });
      setEditingLevel(levelIndex);
      setEditMode(true);
      setCreateMode(true);
      setActiveStep(levelIndex);
    }
  };
  
  // Handle updating an existing location
  const handleUpdateLocation = async () => {
    if (!currentFormData.name) {
      setError('Name is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const locationId = hierarchy[editingLevel].id;
      const payload = {
        name: currentFormData.name,
        short_name: currentFormData.short_name,
        native_name: currentFormData.native_name,
        full_name: currentFormData.full_name,
        latitude: currentFormData.latitude ? parseFloat(currentFormData.latitude) : null,
        longitude: currentFormData.longitude ? parseFloat(currentFormData.longitude) : null,
        population: currentFormData.population ? parseInt(currentFormData.population) : null,
        area: currentFormData.area ? parseFloat(currentFormData.area) : null,
        postal_code: currentFormData.postal_code
      };
      
      const response = await api.put(`/locations/${locationId}`, payload);
      
      const updatedHierarchy = { ...hierarchy, [editingLevel]: response.data };
      setHierarchy(updatedHierarchy);
      
      setSuccess(true);
      setTimeout(() => {
        setEditMode(false);
        setEditingLevel(null);
        setCreateMode(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to update location';
      setError(typeof errorMessage === 'string' ? errorMessage : 'Failed to update location');
    } finally {
      setLoading(false);
    }
  };
  
  // Validate code uniqueness
  const validateCode = async (code) => {
    if (!code || code.length < 3) return;
    setCodeValidating(true);
    try {
      const response = await api.get(`/locations/by-code/${code}`);
      setCodeAvailable(!response.data);
    } catch (err) {
      setCodeAvailable(err.response?.status === 404);
    } finally {
      setCodeValidating(false);
    }
  };
  
  // Handle saving the new location
  const handleSaveNewLocation = async () => {
    if (!currentFormData.name || !currentFormData.code) {
      setError('Name and Code are required');
      return;
    }
    
    if (codeAvailable === false) {
      setError('Code already exists');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const payload = {
        code: currentFormData.code,
        name: currentFormData.name,
        short_name: currentFormData.short_name,
        native_name: currentFormData.native_name,
        full_name: currentFormData.full_name,
        level: currentLevel.level,
        location_type: currentLevel.type,
        parent_id: activeStep > 0 ? hierarchy[activeStep - 1]?.id : null,
        location_mode: 'address',
        status: 'active',
        latitude: currentFormData.latitude ? parseFloat(currentFormData.latitude) : null,
        longitude: currentFormData.longitude ? parseFloat(currentFormData.longitude) : null,
        population: currentFormData.population ? parseInt(currentFormData.population) : null,
        area: currentFormData.area ? parseFloat(currentFormData.area) : null,
        postal_code: currentFormData.postal_code
      };
      
      const response = await api.post('/locations/', payload);
      
      const newLocation = response.data;
      const newHierarchy = { ...hierarchy, [activeStep]: newLocation };
      setHierarchy(newHierarchy);
      setCompletedSteps(prev => ({ ...prev, [activeStep]: true }));
      
      // Ask if user wants to continue
      if (activeStep + 1 < MAX_LEVEL) {
        const confirmContinue = window.confirm(
          `${currentLevel.name} "${newLocation.name}" created successfully!\n\nWould you like to add a ${nextLevel?.name} under this ${currentLevel.name}?`
        );
        
        if (confirmContinue) {
          setCurrentFormData({
            code: '',
            name: '',
            short_name: '',
            native_name: '',
            full_name: '',
            latitude: '',
            longitude: '',
            population: '',
            area: '',
            postal_code: ''
          });
          setCreateMode(false);
          setActiveStep(activeStep + 1);
          setSelectedExisting(null);
          setCodeAvailable(null);
        } else {
          setStopLevel(activeStep);
          setSuccess(true);
          setTimeout(() => {
            onSuccess?.(buildCompleteHierarchy());
            onClose();
          }, 1500);
        }
      } else {
        setStopLevel(activeStep);
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.(buildCompleteHierarchy());
          onClose();
        }, 1500);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to save location';
      setError(typeof errorMessage === 'string' ? errorMessage : 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle going back
  const handleGoBack = () => {
    if (activeStep > 0) {
      const newHierarchy = { ...hierarchy };
      delete newHierarchy[activeStep];
      setHierarchy(newHierarchy);
      setCompletedSteps(prev => ({ ...prev, [activeStep]: false }));
      setActiveStep(activeStep - 1);
      setCreateMode(false);
      setEditMode(false);
      setEditingLevel(null);
      setSelectedExisting(hierarchy[activeStep - 1] || null);
      setError(null);
      setCodeAvailable(null);
    }
  };
  
  // Handle reset
  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all progress?')) {
      setHierarchy({});
      setActiveStep(0);
      setCompletedSteps({});
      setStopLevel(null);
      setCreateMode(false);
      setEditMode(false);
      setEditingLevel(null);
      setSelectedExisting(null);
      setCurrentFormData({
        code: '',
        name: '',
        short_name: '',
        native_name: '',
        full_name: '',
        latitude: '',
        longitude: '',
        population: '',
        area: '',
        postal_code: ''
      });
      setError(null);
      setCodeAvailable(null);
    }
  };
  
  // Build complete hierarchy
  const buildCompleteHierarchy = () => {
    const result = [];
    const maxLevel = stopLevel !== null ? stopLevel : activeStep - 1;
    for (let i = 0; i <= maxLevel; i++) {
      if (hierarchy[i]) {
        result.push({
          level: ADDRESS_LEVELS[i].level,
          name: ADDRESS_LEVELS[i].name,
          data: hierarchy[i]
        });
      }
    }
    return result;
  };
  
  // Handle finish
  const handleFinish = () => {
    onSuccess?.(buildCompleteHierarchy());
    onClose();
  };
  
  // Get level color
  const getLevelColor = (level) => {
    const info = ADDRESS_LEVELS.find(l => l.level === level);
    if (!info) return theme.palette.primary.main;
    return isDark ? info.darkColor : info.color;
  };
  
  // Render step content
  const renderStepContent = () => {
    if (createMode && !editMode) {
      return (
        <Stack spacing={2}>
          <Alert severity="info" icon={<AddCircleIcon />}>
            Creating new {currentLevel.name}
            {activeStep > 0 && hierarchy[activeStep - 1] && (
              <Typography variant="caption" display="block" color="text.secondary">
                Parent: {hierarchy[activeStep - 1].name}
              </Typography>
            )}
          </Alert>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={`${currentLevel.name} Name *`}
                value={currentFormData.name}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={loading}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {currentLevel.icon}
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Code *"
                value={currentFormData.code}
                onChange={(e) => {
                  const value = e.target.value;
                  setCurrentFormData(prev => ({ ...prev, code: value }));
                  if (value.length >= 3) {
                    validateCode(value);
                  }
                }}
                disabled={loading}
                error={codeAvailable === false}
                helperText={codeAvailable === false ? 'Code already exists' : 'Unique identifier (3+ characters)'}
                size="small"
                InputProps={{
                  endAdornment: codeValidating && <CircularProgress size={20} />
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Short Name"
                value={currentFormData.short_name}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, short_name: e.target.value }))}
                disabled={loading}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Native Name"
                value={currentFormData.native_name}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, native_name: e.target.value }))}
                disabled={loading}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                value={currentFormData.full_name}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, full_name: e.target.value }))}
                disabled={loading}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Latitude"
                type="number"
                value={currentFormData.latitude}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, latitude: e.target.value }))}
                disabled={loading}
                placeholder="-1.286389"
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Longitude"
                type="number"
                value={currentFormData.longitude}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, longitude: e.target.value }))}
                disabled={loading}
                placeholder="36.821946"
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Population"
                type="number"
                value={currentFormData.population}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, population: e.target.value }))}
                disabled={loading}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Area (km²)"
                type="number"
                value={currentFormData.area}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, area: e.target.value }))}
                disabled={loading}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Postal Code"
                value={currentFormData.postal_code}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                disabled={loading}
                size="small"
              />
            </Grid>
          </Grid>
        </Stack>
      );
    }
    
    if (editMode) {
      return (
        <Stack spacing={2}>
          <Alert severity="warning" icon={<EditIcon />}>
            Editing {ADDRESS_LEVELS[editingLevel].name}: {hierarchy[editingLevel]?.name}
          </Alert>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={currentFormData.name}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, name: e.target.value }))}
                disabled={loading}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Code"
                value={currentFormData.code}
                disabled
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Short Name"
                value={currentFormData.short_name}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, short_name: e.target.value }))}
                disabled={loading}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Native Name"
                value={currentFormData.native_name}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, native_name: e.target.value }))}
                disabled={loading}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                value={currentFormData.full_name}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, full_name: e.target.value }))}
                disabled={loading}
                size="small"
              />
            </Grid>
          </Grid>
        </Stack>
      );
    }
    
    if (success) {
      return (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          Successfully added {Object.keys(hierarchy).length} location(s)!
        </Alert>
      );
    }
    
    // Selection interface
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {currentLevel.label}
          {activeStep > 0 && hierarchy[activeStep - 1] && (
            <Typography variant="caption" display="block" color="text.secondary">
              Parent: {hierarchy[activeStep - 1].name}
            </Typography>
          )}
        </Typography>
        
        <Autocomplete
          options={parentOptions}
          loading={loadingParents}
          getOptionLabel={(option) => option?.name ? `${option.name} (${option.code})` : ''}
          value={selectedExisting}
          onChange={handleSelectExisting}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={`Search for existing ${currentLevel.name.toLowerCase()}...`}
              size="small"
              fullWidth
            />
          )}
          loadingText="Loading..."
          noOptionsText={`No existing ${currentLevel.name.toLowerCase()} found`}
          isOptionEqualToValue={(option, value) => option?.id === value?.id}
        />
        
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {selectedExisting && (
            <Button
              variant="contained"
              onClick={handleContinueWithExisting}
              endIcon={<ArrowForwardIcon />}
            >
              Use Selected {currentLevel.name}
            </Button>
          )}
          
          <Button
            variant="outlined"
            onClick={handleCreateNew}
            startIcon={<AddCircleIcon />}
          >
            Create New {currentLevel.name}
          </Button>
        </Stack>
      </Stack>
    );
  };
  
  // Render hierarchy summary
  const renderHierarchySummary = () => {
    const levels = Object.keys(hierarchy).sort();
    if (levels.length === 0) return null;
    
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="caption" color="text.secondary">
            Selected Hierarchy:
          </Typography>
          <Button size="small" onClick={handleReset} disabled={loading}>
            Reset All
          </Button>
        </Stack>
        <Stack direction="row" flexWrap="wrap" spacing={1}>
          {levels.map(level => (
            <Chip
              key={level}
              label={`${ADDRESS_LEVELS[parseInt(level)].name}: ${hierarchy[level].name}`}
              size="small"
              onDelete={() => handleEditLevel(parseInt(level))}
              deleteIcon={<EditIcon />}
              sx={{
                bgcolor: alpha(getLevelColor(ADDRESS_LEVELS[parseInt(level)].level), 0.1),
                color: getLevelColor(ADDRESS_LEVELS[parseInt(level)].level),
                '&:hover': {
                  bgcolor: alpha(getLevelColor(ADDRESS_LEVELS[parseInt(level)].level), 0.2),
                }
              }}
              icon={ADDRESS_LEVELS[parseInt(level)].icon}
            />
          ))}
        </Stack>
      </Paper>
    );
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: 'none',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{
        pb: 2,
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.default'
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AddLocationIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={700} color="text.primary">
              {isEdit ? 'Edit Address Hierarchy' : 'Add Address Hierarchy'}
            </Typography>
          </Stack>
          <IconButton onClick={onClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2, overflow: 'auto' }}>
        <Stack spacing={3}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {renderHierarchySummary()}
          
          {!isEdit && (
            <Stepper activeStep={activeStep} orientation="vertical">
              {ADDRESS_LEVELS.map((level, index) => (
                <Step key={level.level} completed={completedSteps[index]}>
                  <StepLabel
                    StepIconProps={{
                      sx: {
                        '&.Mui-completed': {
                          color: getLevelColor(level.level)
                        },
                        '&.Mui-active': {
                          color: getLevelColor(level.level)
                        }
                      }
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {level.icon}
                      <Typography variant="body2" fontWeight={index === activeStep ? 600 : 400}>
                        {level.name}
                      </Typography>
                      {completedSteps[index] && (
                        <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      )}
                    </Stack>
                  </StepLabel>
                  <StepContent>
                    {index === activeStep && renderStepContent()}
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          )}
          
          {isEdit && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Editing existing location
              </Typography>
              <TextField
                fullWidth
                label="Name"
                value={initialData?.name || ''}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, name: e.target.value }))}
                size="small"
              />
              <TextField
                fullWidth
                label="Code"
                value={initialData?.code || ''}
                disabled
                size="small"
              />
              <Button
                variant="contained"
                onClick={handleUpdateLocation}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
              >
                Save Changes
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        
        {!isEdit && activeStep > 0 && !success && (
          <Button onClick={handleGoBack} disabled={loading} startIcon={<ArrowBackIcon />}>
            Back to {ADDRESS_LEVELS[activeStep - 1]?.name}
          </Button>
        )}
        
        {!isEdit && Object.keys(hierarchy).length > 0 && !success && (
          <Button onClick={handleReset} disabled={loading} color="warning">
            Reset All
          </Button>
        )}
        
        {createMode && !isEdit && !success && (
          <>
            <Button onClick={() => {
              setCreateMode(false);
              setEditMode(false);
              setEditingLevel(null);
            }} disabled={loading}>
              Back to Selection
            </Button>
            <Button
              variant="contained"
              onClick={editMode ? handleUpdateLocation : handleSaveNewLocation}
              disabled={loading || !currentFormData.name || (editMode ? false : (!currentFormData.code || codeAvailable === false))}
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            >
              {editMode ? `Update ${currentLevel.name}` : `Save ${currentLevel.name}`}
            </Button>
          </>
        )}
        
        {success && (
          <Button variant="contained" onClick={handleFinish}>
            Finish
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AddressForm;