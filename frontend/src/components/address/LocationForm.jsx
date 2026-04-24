// src/components/address/LocationForm.jsx
import React, { useState, useEffect } from 'react';
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
  Breadcrumbs,
  Autocomplete,
  InputAdornment,
  useTheme,
  alpha
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  LocationOn as LocationIcon,
  Public as PublicIcon,
  Apartment as ApartmentIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  Map as MapIcon
} from '@mui/icons-material';
import api from '../../services/api';

// Level configurations with dark mode compatible colors
const ADDRESS_LEVELS = [
  { level: 1, name: 'Country', type: 'country', icon: <PublicIcon />, color: '#4CAF50', darkColor: '#81C784' },
  { level: 2, name: 'Region', type: 'region', icon: <FlagIcon />, color: '#2196F3', darkColor: '#64B5F6' },
  { level: 3, name: 'District', type: 'district', icon: <TerrainIcon />, color: '#9C27B0', darkColor: '#CE93D8' },
  { level: 4, name: 'County', type: 'county', icon: <BusinessIcon />, color: '#FF9800', darkColor: '#FFB74D' },
  { level: 5, name: 'Subcounty', type: 'subcounty', icon: <HomeIcon />, color: '#795548', darkColor: '#A1887F' },
  { level: 6, name: 'Parish', type: 'parish', icon: <LocationIcon />, color: '#607D8B', darkColor: '#90A4AE' },
  { level: 7, name: 'Village', type: 'village', icon: <HomeIcon />, color: '#8BC34A', darkColor: '#AED581' }
];

const BUILDINGS_LEVELS = [
  { level: 11, name: 'Office', type: 'office', icon: <ApartmentIcon />, color: '#E91E63', darkColor: '#F06292' },
  { level: 12, name: 'Building', type: 'building', icon: <BusinessIcon />, color: '#3F51B5', darkColor: '#7986CB' },
  { level: 13, name: 'Room', type: 'room', icon: <LocationIcon />, color: '#009688', darkColor: '#4DB6AC' },
  { level: 14, name: 'Conference', type: 'conference', icon: <MapIcon />, color: '#673AB7', darkColor: '#9575CD' }
];

const LocationForm = ({ open, onClose, onSuccess, initialData, mode = 'create', locationMode = 'address' }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    short_name: '',
    native_name: '',
    full_name: '',
    level: locationMode === 'address' ? 1 : 11,
    location_type: '',
    parent_id: null,
    status: 'active',
    latitude: '',
    longitude: '',
    population: '',
    area: '',
    postal_code: ''
  });
  
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState(null);
  const [parentOptions, setParentOptions] = useState([]);
  const [loadingParents, setLoadingParents] = useState(false);
  
  const isEdit = mode === 'edit';
  const levels = locationMode === 'buildings' ? BUILDINGS_LEVELS : ADDRESS_LEVELS;
  const currentLevel = levels.find(l => l.level === formData.level);
  
  useEffect(() => {
    if (formData.level && formData.level > (locationMode === 'buildings' ? 11 : 1)) {
      fetchParentOptions(locationMode === 'buildings' ? formData.level - 1 : formData.level - 1);
    }
  }, [formData.level, locationMode]);

  useEffect(() => {
    if (formData.parent_id) fetchAncestors();
    else setAncestors([]);
  }, [formData.parent_id]);

  useEffect(() => {
    if (open && initialData && isEdit) {
      setFormData({
        ...initialData,
        latitude: initialData.latitude || '',
        longitude: initialData.longitude || '',
        population: initialData.population || '',
        area: initialData.area || '',
      });
    }
  }, [open, initialData, isEdit]);

  const fetchParentOptions = async (level) => {
    setLoadingParents(true);
    try {
      const response = await api.get('/locations/', { params: { level, limit: 100, location_mode: locationMode } });
      setParentOptions(response.data?.items || []);
    } catch (err) { console.error(err); } finally { setLoadingParents(false); }
  };

  const fetchAncestors = async () => {
    try {
      const response = await api.get(`/locations/${formData.parent_id}/ancestors`);
      setAncestors(response.data || []);
    } catch (err) { console.error(err); }
  };

  const validateCode = async (code) => {
    if (!code || code.length < 3 || isEdit) return;
    setCodeValidating(true);
    try {
      const response = await api.get(`/locations/by-code/${code}`);
      setCodeAvailable(!response.data);
    } catch (err) { setCodeAvailable(err.response?.status === 404); } finally { setCodeValidating(false); }
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'code') validateCode(value);
    if (field === 'level') {
      const info = levels.find(l => l.level === value);
      setFormData(prev => ({ ...prev, level: value, location_type: info?.type || '', parent_id: null }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) { setError('Name and Code are required'); return; }
    setLoading(true);
    try {
      const payload = { ...formData, location_mode: locationMode };
      const response = isEdit ? await api.put(`/locations/${initialData.id}`, payload) : await api.post('/locations/', payload);
      setSuccess(true);
      setTimeout(() => { onSuccess?.(response.data); onClose(); }, 1500);
    } catch (err) { setError(err.response?.data?.detail || 'Failed to save'); } finally { setLoading(false); }
  };

  const getLevelColor = (level) => {
    const levelInfo = levels.find(l => l.level === level);
    if (!levelInfo) return theme.palette.primary.main;
    return isDark ? levelInfo.darkColor : levelInfo.color;
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
          backgroundImage: 'none',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: 1, 
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.default'
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ color: 'primary.main', display: 'flex' }}>
              {locationMode === 'address' ? <PublicIcon /> : <ApartmentIcon />}
            </Box>
            <Typography variant="h6" fontWeight={700} color="text.primary">
              {isEdit ? 'Edit Location' : `New ${locationMode === 'address' ? 'Address' : 'Building'}`}
            </Typography>
            {currentLevel && (
              <Chip 
                label={currentLevel.name} 
                size="small" 
                sx={{ 
                  bgcolor: alpha(getLevelColor(currentLevel.level), isDark ? 0.15 : 0.1),
                  color: getLevelColor(currentLevel.level),
                  fontWeight: 600,
                  border: `1px solid ${alpha(getLevelColor(currentLevel.level), 0.3)}`,
                  '& .MuiChip-icon': { color: 'inherit' }
                }}
                icon={React.cloneElement(currentLevel.icon, { style: { color: 'inherit', fontSize: '1.2rem' } })}
              />
            )}
          </Stack>
          <IconButton 
            onClick={onClose} 
            size="small" 
            disabled={loading}
            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.1) } }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2, bgcolor: 'background.paper' }}>
        <Stack spacing={3}>
          {error && (
            <Alert 
              severity="error" 
              variant={isDark ? "outlined" : "standard"}
              onClose={() => setError(null)}
              sx={{ borderColor: 'error.main' }}
            >
              {error}
            </Alert>
          )}
          {success && (
            <Alert 
              severity="success" 
              variant={isDark ? "outlined" : "standard"}
              sx={{ borderColor: 'success.main' }}
            >
              Saved successfully!
            </Alert>
          )}
          
          {/* Hierarchy Preview */}
          {ancestors.length > 0 && (
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: isDark ? alpha(theme.palette.primary.main, 0.05) : 'grey.50',
                borderColor: 'divider',
                borderRadius: 1
              }}
            >
              <Typography variant="caption" sx={{ 
                color: 'text.secondary', 
                mb: 1, 
                display: 'block', 
                textTransform: 'uppercase', 
                letterSpacing: 1,
                fontWeight: 600
              }}>
                Location Hierarchy
              </Typography>
              <Breadcrumbs separator={<Typography color="text.disabled" sx={{ fontSize: '1.2rem' }}>›</Typography>}>
                {ancestors.map(ancestor => (
                  <Typography key={ancestor.id} variant="body2" color="text.secondary">
                    {ancestor.name}
                  </Typography>
                ))}
                <Typography variant="body2" color="primary" fontWeight={600}>
                  {formData.name || '...'}
                </Typography>
              </Breadcrumbs>
            </Paper>
          )}
          
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location Name *"
                value={formData.name}
                onChange={handleChange('name')}
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                    '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 2 },
                  },
                  '& .MuiInputLabel-root': { color: 'text.secondary' },
                  '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ color: alpha(theme.palette.text.primary, 0.5), display: 'flex' }}>
                        {currentLevel?.icon}
                      </Box>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location Code *"
                value={formData.code}
                onChange={handleChange('code')}
                disabled={loading || isEdit}
                error={codeAvailable === false && !isEdit}
                helperText={codeAvailable === false && !isEdit ? 'Code already exists' : 'Unique identifier'}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                    '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 2 },
                  },
                  '& .MuiInputLabel-root': { color: 'text.secondary' },
                  '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
                }}
                InputProps={{
                  endAdornment: codeValidating && (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'text.secondary' }}>Level</InputLabel>
                <Select
                  value={formData.level}
                  label="Level"
                  onChange={handleChange('level')}
                  disabled={loading || isEdit}
                  sx={{
                    bgcolor: 'background.default',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 },
                    '& .MuiSelect-select': { color: 'text.primary' }
                  }}
                >
                  {levels.map(level => (
                    <MenuItem key={level.level} value={level.level} sx={{ color: 'text.primary' }}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ color: getLevelColor(level.level), display: 'flex' }}>{level.icon}</Box>
                        <Box>
                          <Typography variant="body2">{level.name}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Level {level.level}</Typography>
                        </Box>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              {formData.level > (locationMode === 'buildings' ? 11 : 1) ? (
                <Autocomplete
                  options={parentOptions}
                  loading={loadingParents}
                  getOptionLabel={(option) => `${option.name} (${option.code})`}
                  value={parentOptions.find(p => p.id === formData.parent_id) || null}
                  onChange={(e, newValue) => setFormData(prev => ({ ...prev, parent_id: newValue?.id || null }))}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label={`Parent ${levels.find(l => l.level === formData.level - 1)?.name}`}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: theme.palette.divider },
                          '&:hover fieldset': { borderColor: 'primary.main' },
                          '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 2 },
                        },
                        '& .MuiInputLabel-root': { color: 'text.secondary' },
                        '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
                      }}
                    />
                  )}
                  sx={{
                    '& .MuiAutocomplete-inputRoot': {
                      bgcolor: 'background.default',
                    }
                  }}
                />
              ) : (
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 1, 
                  bgcolor: 'action.hover', 
                  border: '1px dashed', 
                  borderColor: 'divider',
                  textAlign: 'center'
                }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Top-level location. No parent required.
                  </Typography>
                </Box>
              )}
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 1 }}>
            <Chip 
              label="Geographic & Additional Data" 
              size="small" 
              variant="outlined" 
              sx={{ 
                opacity: 0.7,
                borderColor: 'divider',
                color: 'text.secondary'
              }} 
            />
          </Divider>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Latitude" 
                type="number" 
                value={formData.latitude} 
                onChange={handleChange('latitude')} 
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                  },
                  '& .MuiInputLabel-root': { color: 'text.secondary' },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Longitude" 
                type="number" 
                value={formData.longitude} 
                onChange={handleChange('longitude')} 
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                  },
                  '& .MuiInputLabel-root': { color: 'text.secondary' },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                fullWidth 
                label="Population" 
                type="number" 
                value={formData.population} 
                onChange={handleChange('population')} 
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                  },
                  '& .MuiInputLabel-root': { color: 'text.secondary' },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                fullWidth 
                label="Area (km²)" 
                type="number" 
                value={formData.area} 
                onChange={handleChange('area')} 
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                  },
                  '& .MuiInputLabel-root': { color: 'text.secondary' },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'text.secondary' }}>Status</InputLabel>
                <Select 
                  value={formData.status} 
                  label="Status" 
                  onChange={handleChange('status')} 
                  disabled={loading}
                  sx={{
                    bgcolor: 'background.default',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 },
                    '& .MuiSelect-select': { color: 'text.primary' }
                  }}
                >
                  <MenuItem value="active" sx={{ color: 'text.primary' }}>Active</MenuItem>
                  <MenuItem value="inactive" sx={{ color: 'text.primary' }}>Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ 
        p: 3, 
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.default'
      }}>
        <Button 
          onClick={onClose} 
          disabled={loading} 
          sx={{ 
            color: 'text.secondary',
            '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.1) }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !formData.name || !formData.code || (codeAvailable === false && !isEdit)}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          sx={{ 
            px: 4,
            bgcolor: 'primary.main',
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' }
          }}
        >
          {isEdit ? 'Update Location' : 'Create Location'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LocationForm;