// src/components/address/BuildingForm.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Breadcrumbs,
  Autocomplete,
  InputAdornment,
  useTheme,
  alpha,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Apartment as ApartmentIcon,
  Business as BusinessIcon,
  MeetingRoom as MeetingRoomIcon,
  EventSeat as EventSeatIcon,
  LocationOn as LocationIcon,
  AddCircle as AddCircleIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Link as LinkIcon,
  Search as SearchIcon,
  Home as HomeIcon,
  Public as PublicIcon,
  Flag as FlagIcon,
  Terrain as TerrainIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  MyLocation as MyLocationIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import api from '../../services/api';

const BUILDINGS_LEVELS = [
  { level: 11, name: 'Office', type: 'office', icon: <ApartmentIcon />, color: '#E91E63', darkColor: '#F06292', label: 'Create Office' },
  { level: 12, name: 'Building', type: 'building', icon: <BusinessIcon />, color: '#3F51B5', darkColor: '#7986CB', label: 'Create Building' },
  { level: 13, name: 'Room', type: 'room', icon: <MeetingRoomIcon />, color: '#009688', darkColor: '#4DB6AC', label: 'Create Room' },
  { level: 14, name: 'Conference', type: 'conference', icon: <EventSeatIcon />, color: '#673AB7', darkColor: '#9575CD', label: 'Create Conference' }
];

const ADDRESS_LEVELS = [
  { level: 1, name: 'Country', icon: <PublicIcon /> },
  { level: 2, name: 'Region', icon: <FlagIcon /> },
  { level: 3, name: 'District', icon: <TerrainIcon /> },
  { level: 4, name: 'County', icon: <BusinessIcon /> },
  { level: 5, name: 'Subcounty', icon: <HomeIcon /> },
  { level: 6, name: 'Parish', icon: <LocationIcon /> },
  { level: 7, name: 'Village', icon: <HomeIcon /> }
];

const MAX_LEVEL = 14;
const MIN_LEVEL = 11;

const EMPTY_FORM = {
  code: '',
  name: '',
  short_name: '',
  full_name: '',
  latitude: '',
  longitude: '',
  area: '',
  floor_number: '',
  capacity: '',
  features: ''
};

// Helper function to generate valid code from name
const generateCodeFromName = (name) => {
  if (!name) return '';
  return name
    .toUpperCase()
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const BuildingForm = ({ open, onClose, onSuccess, initialData, mode = 'create' }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Hierarchy state
  const [hierarchy, setHierarchy] = useState({});
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState({});
  const [stopLevel, setStopLevel] = useState(null);

  // Address selection state
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addressHierarchy, setAddressHierarchy] = useState([]);
  const [addressSearchTerm, setAddressSearchTerm] = useState('');
  const [addressOptions, setAddressOptions] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressSearchResults, setAddressSearchResults] = useState([]);

  // Form state
  const [currentFormData, setCurrentFormData] = useState(EMPTY_FORM);
  const [selectedExisting, setSelectedExisting] = useState(null);
  const [parentOptions, setParentOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingParents, setLoadingParents] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState(null);
  const [createMode, setCreateMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [hasExistingBuildings, setHasExistingBuildings] = useState(true);

  const isEdit = mode === 'edit';
  const currentLevel = BUILDINGS_LEVELS[activeStep];
  const nextLevel = BUILDINGS_LEVELS[activeStep + 1];

  // ─── Stable refs so callbacks don't change identity when state changes ────
  const hierarchyRef = useRef(hierarchy);
  const activeStepRef = useRef(activeStep);
  const createModeRef = useRef(createMode);
  useEffect(() => { hierarchyRef.current = hierarchy; }, [hierarchy]);
  useEffect(() => { activeStepRef.current = activeStep; }, [activeStep]);
  useEffect(() => { createModeRef.current = createMode; }, [createMode]);

  // ─── loadOptions: accepts an explicit step so it never reads stale closure ─
  const loadOptions = useCallback(async (forStep) => {
    const step = forStep !== undefined ? forStep : activeStepRef.current;
    setLoadingParents(true);
    try {
      let params = {
        location_mode: 'buildings',
        limit: 100,
        include_inactive: false
      };

      if (step === 0) {
        params.level = MIN_LEVEL;
      } else {
        const parentEntry = hierarchyRef.current[step - 1];
        if (parentEntry?.id) {
          params.parent_id = parentEntry.id;
        } else {
          setParentOptions([]);
          return;
        }
      }

      const response = await api.get('/locations/', { params });
      const options = response.data?.items || [];
      setParentOptions(options);

      if (step === 0) {
        const hasExisting = options.length > 0;
        setHasExistingBuildings(hasExisting);
        if (!hasExisting && !createModeRef.current && !isEdit) {
          setCreateMode(true);
        }
      }
    } catch (err) {
      console.error('Error loading options:', err);
      setParentOptions([]);
    } finally {
      setLoadingParents(false);
    }
  }, [isEdit]); // isEdit is stable for the lifetime of the dialog

  // ─── Address helpers (unchanged logic, stable refs) ──────────────────────
  const loadAddressWithParents = useCallback(async (addressId) => {
    try {
      const [ancestorsRes, addressRes] = await Promise.all([
        api.get(`/locations/${addressId}/ancestors`),
        api.get(`/locations/${addressId}`)
      ]);
      const fullHierarchy = [...(ancestorsRes.data || [])];
      if (addressRes.data) fullHierarchy.push(addressRes.data);
      setAddressHierarchy(fullHierarchy);
      return fullHierarchy;
    } catch (err) {
      console.error('Error loading address hierarchy:', err);
      return [];
    }
  }, []);

  const loadAddressChildren = useCallback(async (parentId, level) => {
    setLoadingAddresses(true);
    try {
      const params = { location_mode: 'address', limit: 100, include_inactive: false };
      if (parentId) params.parent_id = parentId;
      else params.level = level;
      const response = await api.get('/locations/', { params });
      return response.data?.items || [];
    } catch (err) {
      console.error('Error loading address children:', err);
      return [];
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  const buildAddressTree = useCallback(async () => {
    setLoadingAddresses(true);
    try {
      const countries = await loadAddressChildren(null, 1);
      const tree = [];

      for (const country of countries) {
        const countryNode = { ...country, children: [], level: 1, expanded: false, loading: false };
        const regions = await loadAddressChildren(country.id, 2);
        countryNode.children = await Promise.all(
          regions.map(async (region) => {
            const regionNode = { ...region, children: [], level: 2, expanded: false, loading: false };
            const districts = await loadAddressChildren(region.id, 3);
            regionNode.children = districts.map(d => ({ ...d, children: [], level: d.level, expanded: false, loading: false }));
            return regionNode;
          })
        );
        tree.push(countryNode);
      }
      setAddressOptions(tree);
    } catch (err) {
      console.error('Error building address tree:', err);
      setAddressOptions([]);
    } finally {
      setLoadingAddresses(false);
    }
  }, [loadAddressChildren]);

  const loadNodeChildren = useCallback(async (node) => {
    if (node.children?.length > 0) return node.children;
    setLoadingAddresses(true);
    try {
      const children = await loadAddressChildren(node.id, node.level + 1);
      const newChildren = children.map(c => ({ ...c, children: [], level: c.level, expanded: false, loading: false }));

      const updateTree = (items) => items.map(item => {
        if (item.id === node.id) return { ...item, children: newChildren, expanded: true };
        if (item.children?.length > 0) return { ...item, children: updateTree(item.children) };
        return item;
      });

      setAddressOptions(prev => updateTree(prev));
      return newChildren;
    } catch (err) {
      console.error('Error loading node children:', err);
      return [];
    } finally {
      setLoadingAddresses(false);
    }
  }, [loadAddressChildren]);

  const toggleAddressNode = (nodeId) => {
    const updateTree = (items) => items.map(item => {
      if (item.id === nodeId) {
        if (!item.expanded && (!item.children || item.children.length === 0)) {
          loadNodeChildren(item);
        }
        return { ...item, expanded: !item.expanded };
      }
      if (item.children?.length > 0) return { ...item, children: updateTree(item.children) };
      return item;
    });
    setAddressOptions(prev => updateTree(prev));
  };

  const handleSelectAddress = async (address) => {
    setSelectedAddress(address);
    setShowAddressSearch(false);
    await loadAddressWithParents(address.id);
  };

  const searchAddresses = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) { setAddressSearchResults([]); return; }
    setLoadingAddresses(true);
    try {
      const response = await api.get('/locations/', {
        params: { location_mode: 'address', search: searchTerm, limit: 50, include_inactive: false }
      });
      setAddressSearchResults(response.data?.items || []);
    } catch (err) {
      console.error('Error searching addresses:', err);
      setAddressSearchResults([]);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  // ─── Effects ──────────────────────────────────────────────────────────────

  // Debounced address search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (addressSearchTerm) searchAddresses(addressSearchTerm);
      else setAddressSearchResults([]);
    }, 500);
    return () => clearTimeout(timer);
  }, [addressSearchTerm, searchAddresses]);

  // Build address tree once when panel opens
  useEffect(() => {
    if (showAddressSearch && addressOptions.length === 0) {
      buildAddressTree();
    }
  }, [showAddressSearch]); // intentionally omit buildAddressTree/addressOptions to fire once

  // Load options only when the dialog opens fresh (not in create/edit mode) or step changes
  // We use a ref gate so this doesn't fire when createMode/editMode flip
  const shouldLoadOptions = open && !isEdit && !createMode && !editMode;
  const shouldLoadRef = useRef(shouldLoadOptions);
  useEffect(() => {
    shouldLoadRef.current = shouldLoadOptions;
  });

  useEffect(() => {
    if (!open || isEdit || createMode || editMode) return;
    loadOptions(activeStep);
  }, [activeStep, open, isEdit]); // createMode/editMode deliberately excluded — handled by the gate above

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
              const levelInfo = BUILDINGS_LEVELS.find(l => l.level === ancestor.level);
              if (levelInfo) newHierarchy[levelInfo.level - MIN_LEVEL] = ancestor;
            });
            newHierarchy[initialData.level - MIN_LEVEL] = initialData;
            setHierarchy(newHierarchy);
            setStopLevel(initialData.level - MIN_LEVEL);
            setActiveStep(initialData.level - MIN_LEVEL + 1);
          } else {
            setHierarchy({ [initialData.level - MIN_LEVEL]: initialData });
            setStopLevel(initialData.level - MIN_LEVEL);
            setActiveStep(initialData.level - MIN_LEVEL + 1);
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

  // Reset form when dialog opens fresh
  useEffect(() => {
    if (open && !isEdit) {
      setHierarchy({});
      setActiveStep(0);
      setCompletedSteps({});
      setStopLevel(null);
      setCreateMode(false);
      setEditMode(false);
      setEditingLevel(null);
      setSelectedAddress(null);
      setAddressHierarchy([]);
      setShowAddressSearch(false);
      setCurrentFormData(EMPTY_FORM);
      setSelectedExisting(null);
      setError(null);
      setValidationErrors({});
      setCodeAvailable(null);
      setSuccess(false);
    }
  }, [open]); // only fires when dialog opens/closes

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectExisting = (event, value) => {
    setSelectedExisting(value);
  };

  // KEY FIX: no setTimeout, pass the next step explicitly to loadOptions
  const handleContinueWithExisting = () => {
    if (!selectedExisting) return;

    const nextStep = activeStep + 1;
    const newHierarchy = { ...hierarchy, [activeStep]: selectedExisting };

    setHierarchy(newHierarchy);
    setCompletedSteps(prev => ({ ...prev, [activeStep]: true }));

    if (nextStep < BUILDINGS_LEVELS.length) {
      // Update ref immediately so loadOptions sees the fresh hierarchy
      hierarchyRef.current = newHierarchy;
      setActiveStep(nextStep);
      setSelectedExisting(null);
      // Load options for next step directly — no setTimeout needed
      loadOptions(nextStep);
    } else {
      setStopLevel(activeStep);
      setCreateMode(true);
    }
  };

  const handleCreateNew = () => {
    setCreateMode(true);
    setEditMode(false);
    setEditingLevel(null);
    setShowAddressSearch(activeStep === 0);
    setCurrentFormData(EMPTY_FORM);
    setValidationErrors({});
    setCodeAvailable(null);
  };

  const handleEditLevel = (levelIndex) => {
    const levelData = hierarchy[levelIndex];
    if (levelData) {
      setCurrentFormData({
        code: levelData.code || '',
        name: levelData.name || '',
        short_name: levelData.short_name || '',
        full_name: levelData.full_name || '',
        latitude: levelData.latitude || '',
        longitude: levelData.longitude || '',
        area: levelData.area || '',
        floor_number: levelData.floor_number || '',
        capacity: levelData.capacity || '',
        features: levelData.features || ''
      });
      setEditingLevel(levelIndex);
      setEditMode(true);
      setCreateMode(true);
      setActiveStep(levelIndex);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!currentFormData.name?.trim()) errors.name = 'Name is required';
    if (!currentFormData.code?.trim()) {
      errors.code = 'Code is required';
    } else if (!/^[A-Z0-9_-]+$/.test(currentFormData.code)) {
      errors.code = 'Code can only contain uppercase letters, numbers, underscores, and hyphens';
    }
    if (currentFormData.area !== '') {
      const v = parseFloat(currentFormData.area);
      if (isNaN(v)) errors.area = 'Area must be a valid number';
      else if (v < 0) errors.area = 'Area cannot be negative';
    }
    if (currentFormData.capacity !== '') {
      const v = parseInt(currentFormData.capacity, 10);
      if (isNaN(v)) errors.capacity = 'Capacity must be a valid number';
      else if (v < 0) errors.capacity = 'Capacity cannot be negative';
    }
    if (currentFormData.floor_number !== '') {
      if (isNaN(parseInt(currentFormData.floor_number, 10))) errors.floor_number = 'Floor number must be a valid number';
    }
    if (currentFormData.latitude !== '') {
      const v = parseFloat(currentFormData.latitude);
      if (isNaN(v) || v < -90 || v > 90) errors.latitude = 'Latitude must be between -90 and 90';
    }
    if (currentFormData.longitude !== '') {
      const v = parseFloat(currentFormData.longitude);
      if (isNaN(v) || v < -180 || v > 180) errors.longitude = 'Longitude must be between -180 and 180';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNameChange = (event) => {
    const newName = event.target.value;
    setCurrentFormData(prev => ({
      ...prev,
      name: newName,
      code: prev.code === generateCodeFromName(prev.name) || !prev.code
        ? generateCodeFromName(newName)
        : prev.code
    }));
    if (validationErrors.name) setValidationErrors(prev => ({ ...prev, name: null }));
  };

  const handleFormChange = (field) => (event) => {
    const value = event.target.value;
    setCurrentFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) setValidationErrors(prev => ({ ...prev, [field]: null }));
    if (field === 'code' && value.length >= 3) validateCode(value);
  };

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

  const handleSaveWithAddressLink = async () => {
    if (!selectedAddress) { setError('Please select an address location'); return; }
    if (!validateForm()) { setError('Please fix the validation errors above'); return; }

    setLoading(true);
    setError(null);
    try {
      const locationTypeMap = { 11: 'office', 12: 'building', 13: 'room', 14: 'conference' };
      const payload = {
        location_mode: 'buildings',
        location_type: locationTypeMap[currentLevel.level],
        code: currentFormData.code.toUpperCase().trim(),
        name: currentFormData.name.trim(),
        short_name: currentFormData.short_name?.trim() || null,
        full_name: currentFormData.full_name?.trim() || null,
        level: currentLevel.level,
        status: 'active',
        parent_id: selectedAddress.id,
        gps_coordinates: currentFormData.latitude && currentFormData.longitude
          ? `${currentFormData.latitude},${currentFormData.longitude}` : null,
        area: currentFormData.area ? parseFloat(currentFormData.area) / 1000000 : null,
        extra_metadata: {
          floor_number: currentFormData.floor_number ? parseInt(currentFormData.floor_number, 10) : null,
          capacity: currentFormData.capacity ? parseInt(currentFormData.capacity, 10) : null,
          features: currentFormData.features?.trim() || null,
          area_sqm: currentFormData.area ? parseFloat(currentFormData.area) : null,
          linked_address: {
            id: selectedAddress.id,
            name: selectedAddress.name,
            code: selectedAddress.code,
            hierarchy: addressHierarchy.map(a => ({ id: a.id, name: a.name, level: a.level }))
          }
        }
      };

      const response = await api.post('/locations/', payload);
      const newLocation = response.data;
      const newHierarchy = { ...hierarchy, [activeStep]: newLocation };
      setHierarchy(newHierarchy);
      setCompletedSteps(prev => ({ ...prev, [activeStep]: true }));
      setSuccess(true);
      setTimeout(() => { onSuccess?.(newLocation); onClose(); }, 1500);
    } catch (err) {
      console.error('Save error:', err);
      const errorDetail = err.response?.data?.detail;
      setError(Array.isArray(errorDetail)
        ? errorDetail.map(e => e.msg).join(', ')
        : typeof errorDetail === 'string' ? errorDetail : 'Failed to save building');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!validateForm()) { setError('Please fix the validation errors above'); return; }
    setLoading(true);
    setError(null);
    try {
      const locationId = hierarchy[editingLevel].id;
      const payload = {
        name: currentFormData.name.trim(),
        short_name: currentFormData.short_name?.trim() || null,
        full_name: currentFormData.full_name?.trim() || null,
        gps_coordinates: currentFormData.latitude && currentFormData.longitude
          ? `${currentFormData.latitude},${currentFormData.longitude}` : null,
        area: currentFormData.area ? parseFloat(currentFormData.area) / 1000000 : null,
        extra_metadata: {
          floor_number: currentFormData.floor_number ? parseInt(currentFormData.floor_number, 10) : null,
          capacity: currentFormData.capacity ? parseInt(currentFormData.capacity, 10) : null,
          features: currentFormData.features?.trim() || null,
          area_sqm: currentFormData.area ? parseFloat(currentFormData.area) : null
        }
      };
      const response = await api.put(`/locations/${locationId}`, payload);
      setHierarchy(prev => ({ ...prev, [editingLevel]: response.data }));
      setSuccess(true);
      setTimeout(() => { setEditMode(false); setEditingLevel(null); setCreateMode(false); setSuccess(false); }, 1500);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to update location';
      setError(typeof msg === 'string' ? msg : 'Failed to update location');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewLocation = async () => {
    if (!validateForm()) { setError('Please fix the validation errors above'); return; }
    if (codeAvailable === false) { setError('Code already exists'); return; }

    setLoading(true);
    setError(null);
    try {
      const locationTypeMap = { 11: 'office', 12: 'building', 13: 'room', 14: 'conference' };
      const parentId = activeStep > 0 ? hierarchy[activeStep - 1]?.id ?? null : null;

      const payload = {
        location_mode: 'buildings',
        location_type: locationTypeMap[currentLevel.level],
        code: currentFormData.code.toUpperCase().trim(),
        name: currentFormData.name.trim(),
        short_name: currentFormData.short_name?.trim() || null,
        full_name: currentFormData.full_name?.trim() || null,
        level: currentLevel.level,
        status: 'active',
        parent_id: parentId,
        gps_coordinates: currentFormData.latitude && currentFormData.longitude
          ? `${currentFormData.latitude},${currentFormData.longitude}` : null,
        area: currentFormData.area ? parseFloat(currentFormData.area) / 1000000 : null,
        extra_metadata: {
          floor_number: currentFormData.floor_number ? parseInt(currentFormData.floor_number, 10) : null,
          capacity: currentFormData.capacity ? parseInt(currentFormData.capacity, 10) : null,
          features: currentFormData.features?.trim() || null,
          area_sqm: currentFormData.area ? parseFloat(currentFormData.area) : null
        }
      };

      const response = await api.post('/locations/', payload);
      const newLocation = response.data;
      const newHierarchy = { ...hierarchy, [activeStep]: newLocation };
      setHierarchy(newHierarchy);
      hierarchyRef.current = newHierarchy;
      setCompletedSteps(prev => ({ ...prev, [activeStep]: true }));

      if (activeStep + 1 < BUILDINGS_LEVELS.length) {
        const confirmContinue = window.confirm(
          `${currentLevel.name} "${newLocation.name}" created successfully!\n\nWould you like to add a ${nextLevel?.name} under this ${currentLevel.name}?`
        );
        if (confirmContinue) {
          const nextStep = activeStep + 1;
          setCurrentFormData(EMPTY_FORM);
          setCreateMode(false);
          setActiveStep(nextStep);
          setSelectedExisting(null);
          setValidationErrors({});
          setCodeAvailable(null);
          setShowAddressSearch(false);
          // Load options for next step with fresh hierarchy in ref
          loadOptions(nextStep);
        } else {
          setStopLevel(activeStep);
          setSuccess(true);
          setTimeout(() => { onSuccess?.(buildCompleteHierarchy()); onClose(); }, 1500);
        }
      } else {
        setStopLevel(activeStep);
        setSuccess(true);
        setTimeout(() => { onSuccess?.(buildCompleteHierarchy()); onClose(); }, 1500);
      }
    } catch (err) {
      console.error('Save error:', err);
      const errorDetail = err.response?.data?.detail;
      setError(Array.isArray(errorDetail)
        ? errorDetail.map(e => e.msg).join(', ')
        : typeof errorDetail === 'string' ? errorDetail : 'Failed to save building');
    } finally {
      setLoading(false);
    }
  };

  // KEY FIX: pass explicit step to loadOptions, update ref before state
  const handleGoBack = () => {
    if (activeStep > 0) {
      const prevStep = activeStep - 1;
      const newHierarchy = { ...hierarchy };
      delete newHierarchy[activeStep];
      hierarchyRef.current = newHierarchy;

      setHierarchy(newHierarchy);
      setCompletedSteps(prev => ({ ...prev, [activeStep]: false }));
      setActiveStep(prevStep);
      setCreateMode(false);
      setEditMode(false);
      setEditingLevel(null);
      setSelectedExisting(hierarchy[prevStep] || null);
      setError(null);
      setValidationErrors({});
      setCodeAvailable(null);
      setShowAddressSearch(prevStep === 0);
      loadOptions(prevStep);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all progress?')) {
      hierarchyRef.current = {};
      setHierarchy({});
      setActiveStep(0);
      setCompletedSteps({});
      setStopLevel(null);
      setCreateMode(false);
      setEditMode(false);
      setEditingLevel(null);
      setSelectedExisting(null);
      setSelectedAddress(null);
      setAddressHierarchy([]);
      setShowAddressSearch(false);
      setCurrentFormData(EMPTY_FORM);
      setError(null);
      setValidationErrors({});
      setCodeAvailable(null);
      setSuccess(false);
      loadOptions(0);
    }
  };

  const buildCompleteHierarchy = () => {
    const result = [];
    const maxLevel = stopLevel !== null ? stopLevel : activeStep - 1;
    for (let i = 0; i <= maxLevel; i++) {
      if (hierarchy[i]) result.push({ level: BUILDINGS_LEVELS[i].level, name: BUILDINGS_LEVELS[i].name, data: hierarchy[i] });
    }
    return result;
  };

  const handleFinish = () => { onSuccess?.(buildCompleteHierarchy()); onClose(); };

  const getLevelColor = (level) => {
    const info = BUILDINGS_LEVELS.find(l => l.level === level);
    if (!info) return theme.palette.primary.main;
    return isDark ? info.darkColor : info.color;
  };

  // ─── Render helpers (unchanged from original) ─────────────────────────────

  const renderAddressTreeNode = (node, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const levelInfo = ADDRESS_LEVELS.find(l => l.level === node.level);
    const isExpanded = node.expanded;

    return (
      <Box key={node.id} sx={{ ml: depth * 2 }}>
        <ListItemButton
          onClick={() => toggleAddressNode(node.id)}
          sx={{ borderRadius: 1, mb: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            {hasChildren ? (isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />) : <LocationIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ color: levelInfo ? levelInfo.color : 'text.secondary' }}>{levelInfo?.icon}</Box>
                <Typography variant="body2">{node.name}</Typography>
                <Typography variant="caption" color="text.secondary">({node.code})</Typography>
                <Chip label={`Level ${node.level}: ${levelInfo?.name}`} size="small" variant="outlined" />
              </Stack>
            }
          />
          <Button size="small" variant="contained" color="primary"
            onClick={(e) => { e.stopPropagation(); handleSelectAddress(node); }}>
            Select
          </Button>
        </ListItemButton>
        {hasChildren && isExpanded && (
          <Collapse in={isExpanded}>
            {node.children.map(child => renderAddressTreeNode(child, depth + 1))}
          </Collapse>
        )}
      </Box>
    );
  };

  const renderAddressSearch = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <MyLocationIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={600}>
              Link to Address Location (Country → Region → District → ...)
            </Typography>
            {selectedAddress && (
              <Chip label="Address Selected" size="small" color="success"
                onDelete={() => { setSelectedAddress(null); setAddressHierarchy([]); }} />
            )}
          </Stack>

          <TextField
            fullWidth
            placeholder="Search for address by name (Country, Region, District, Village, etc.)"
            value={addressSearchTerm}
            onChange={(e) => setAddressSearchTerm(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              endAdornment: loadingAddresses && <CircularProgress size={20} />
            }}
          />

          {addressSearchTerm.length > 2 && addressSearchResults.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <List dense>
                {addressSearchResults.map(result => {
                  const levelInfo = ADDRESS_LEVELS.find(l => l.level === result.level);
                  return (
                    <ListItemButton key={result.id} onClick={() => handleSelectAddress(result)}
                      sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <ListItemIcon>{levelInfo?.icon || <LocationIcon />}</ListItemIcon>
                      <ListItemText
                        primary={result.name}
                        secondary={`${result.code} • ${levelInfo?.name || `Level ${result.level}`}`}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          )}

          {!addressSearchTerm && addressOptions.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Typography variant="caption" sx={{ p: 1, color: 'text.secondary' }}>
                Browse from Country down to Village:
              </Typography>
              <List dense>
                {addressOptions.map(node => renderAddressTreeNode(node))}
              </List>
            </Paper>
          )}

          {selectedAddress && addressHierarchy.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Selected Address Path (Country → Region → District → ...):
              </Typography>
              <Breadcrumbs separator={<ArrowForwardIcon fontSize="small" />}>
                {addressHierarchy.map((item, idx) => (
                  <Typography key={item.id} variant="body2" sx={{
                    color: idx === addressHierarchy.length - 1 ? 'primary.main' : 'text.secondary',
                    fontWeight: idx === addressHierarchy.length - 1 ? 600 : 400
                  }}>
                    {item.name}
                  </Typography>
                ))}
              </Breadcrumbs>
            </Paper>
          )}

          {!selectedAddress && (
            <Alert severity="info" variant="outlined">
              Select an address from the tree above or search to link this office to a physical location.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );

  const renderStepContent = () => {
    if (createMode && !editMode) {
      let parentInfo = null;
      if (activeStep === 0 && selectedAddress) {
        parentInfo = `Office will be created under: ${selectedAddress.name}`;
        if (addressHierarchy.length > 0) parentInfo += ` (${addressHierarchy.map(a => a.name).join(' → ')})`;
      } else if (activeStep > 0 && hierarchy[activeStep - 1]) {
        parentInfo = `${currentLevel.name} will be created under: ${hierarchy[activeStep - 1].name} (${BUILDINGS_LEVELS[activeStep - 1].name})`;
      }

      return (
        <Stack spacing={3}>
          {activeStep === 0 && renderAddressSearch()}
          {parentInfo && <Alert severity="info" icon={<LinkIcon />}>{parentInfo}</Alert>}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>{currentLevel.name} Details</Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label={`${currentLevel.name} Name *`} value={currentFormData.name}
                    onChange={handleNameChange} disabled={loading} error={!!validationErrors.name}
                    helperText={validationErrors.name} size="small"
                    InputProps={{ startAdornment: <InputAdornment position="start">{currentLevel.icon}</InputAdornment> }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Code *" value={currentFormData.code}
                    onChange={handleFormChange('code')} disabled={loading}
                    error={!!validationErrors.code || codeAvailable === false}
                    helperText={validationErrors.code || (codeAvailable === false ? 'Code already exists' : 'Unique identifier (3+ characters)')}
                    size="small" InputProps={{ endAdornment: codeValidating && <CircularProgress size={20} /> }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Short Name" value={currentFormData.short_name}
                    onChange={handleFormChange('short_name')} disabled={loading} size="small" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Full Name" value={currentFormData.full_name}
                    onChange={handleFormChange('full_name')} disabled={loading} size="small" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Latitude" type="number" value={currentFormData.latitude}
                    onChange={handleFormChange('latitude')} disabled={loading} placeholder="-1.286389"
                    error={!!validationErrors.latitude} helperText={validationErrors.latitude} size="small" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Longitude" type="number" value={currentFormData.longitude}
                    onChange={handleFormChange('longitude')} disabled={loading} placeholder="36.821946"
                    error={!!validationErrors.longitude} helperText={validationErrors.longitude} size="small" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Area (m²)" type="number" value={currentFormData.area}
                    onChange={handleFormChange('area')} disabled={loading} placeholder="Square meters"
                    error={!!validationErrors.area} helperText={validationErrors.area || "Floor area in square meters"} size="small" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Floor Number" type="number" value={currentFormData.floor_number}
                    onChange={handleFormChange('floor_number')} disabled={loading} placeholder="e.g., 3"
                    error={!!validationErrors.floor_number} helperText={validationErrors.floor_number || "Floor level (ground floor = 0)"} size="small" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Capacity" type="number" value={currentFormData.capacity}
                    onChange={handleFormChange('capacity')} disabled={loading} placeholder="Number of people"
                    error={!!validationErrors.capacity} helperText={validationErrors.capacity || "Maximum occupancy"} size="small" />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Features / Amenities" value={currentFormData.features}
                    onChange={handleFormChange('features')} disabled={loading} multiline rows={3}
                    placeholder="List key features (e.g., WiFi, Projector, AC, etc.)"
                    helperText="Separate features with commas" size="small" />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Stack>
      );
    }

    if (editMode) {
      return (
        <Stack spacing={2}>
          <Alert severity="warning" icon={<EditIcon />}>
            Editing {BUILDINGS_LEVELS[editingLevel].name}: {hierarchy[editingLevel]?.name}
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label="Name" value={currentFormData.name} onChange={handleNameChange}
                disabled={loading} error={!!validationErrors.name} helperText={validationErrors.name} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Code" value={currentFormData.code} disabled size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Short Name" value={currentFormData.short_name}
                onChange={handleFormChange('short_name')} disabled={loading} size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Full Name" value={currentFormData.full_name}
                onChange={handleFormChange('full_name')} disabled={loading} size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Area (m²)" type="number" value={currentFormData.area}
                onChange={handleFormChange('area')} disabled={loading} size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Floor Number" type="number" value={currentFormData.floor_number}
                onChange={handleFormChange('floor_number')} disabled={loading} size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Capacity" type="number" value={currentFormData.capacity}
                onChange={handleFormChange('capacity')} disabled={loading} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Features" value={currentFormData.features}
                onChange={handleFormChange('features')} disabled={loading} multiline rows={2} size="small" />
            </Grid>
          </Grid>
        </Stack>
      );
    }

    if (success) {
      return (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          Successfully added {Object.keys(hierarchy).length} building(s)!
        </Alert>
      );
    }

    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Select existing {currentLevel.name} or create a new one
          {activeStep > 0 && hierarchy[activeStep - 1] && (
            <Typography variant="caption" display="block" color="text.secondary">
              Parent: {hierarchy[activeStep - 1].name} ({BUILDINGS_LEVELS[activeStep - 1].name})
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
            <TextField {...params} placeholder={`Search for existing ${currentLevel.name.toLowerCase()}...`}
              size="small" fullWidth />
          )}
          loadingText="Loading..."
          noOptionsText={`No existing ${currentLevel.name.toLowerCase()} found`}
          isOptionEqualToValue={(option, value) => option?.id === value?.id}
        />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {selectedExisting && (
            <Button variant="contained" onClick={handleContinueWithExisting} endIcon={<ArrowForwardIcon />}>
              Use Selected {currentLevel.name}
            </Button>
          )}
          <Button variant="outlined" onClick={handleCreateNew} startIcon={<AddCircleIcon />}>
            Create New {currentLevel.name}
          </Button>
        </Stack>
      </Stack>
    );
  };

  const renderHierarchySummary = () => {
    const levels = Object.keys(hierarchy).sort();
    if (levels.length === 0) return null;
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="caption" color="text.secondary">Selected Building Hierarchy:</Typography>
          <Button size="small" onClick={handleReset} disabled={loading}>Reset All</Button>
        </Stack>
        <Stack direction="row" flexWrap="wrap" spacing={1}>
          {levels.map(level => (
            <Chip key={level}
              label={`${BUILDINGS_LEVELS[parseInt(level)].name}: ${hierarchy[level].name}`}
              size="small"
              onDelete={() => handleEditLevel(parseInt(level))}
              deleteIcon={<EditIcon />}
              sx={{
                bgcolor: alpha(getLevelColor(BUILDINGS_LEVELS[parseInt(level)].level), 0.1),
                color: getLevelColor(BUILDINGS_LEVELS[parseInt(level)].level),
                '&:hover': { bgcolor: alpha(getLevelColor(BUILDINGS_LEVELS[parseInt(level)].level), 0.2) }
              }}
              icon={BUILDINGS_LEVELS[parseInt(level)].icon}
            />
          ))}
        </Stack>
      </Paper>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper', borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: 'none', maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ pb: 2, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: 'background.default' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ApartmentIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={700} color="text.primary">
              {isEdit ? 'Edit Building Hierarchy' : 'Add Building Hierarchy'}
            </Typography>
          </Stack>
          <IconButton onClick={onClose} disabled={loading}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ mt: 2, overflow: 'auto' }}>
        <Stack spacing={3}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {renderHierarchySummary()}

          {!isEdit && (
            <Stepper activeStep={activeStep} orientation="vertical">
              {BUILDINGS_LEVELS.map((level, index) => (
                <Step key={level.level} completed={completedSteps[index]}>
                  <StepLabel StepIconProps={{
                    sx: {
                      '&.Mui-completed': { color: getLevelColor(level.level) },
                      '&.Mui-active': { color: getLevelColor(level.level) }
                    }
                  }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {level.icon}
                      <Typography variant="body2" fontWeight={index === activeStep ? 600 : 400}>{level.name}</Typography>
                      {completedSteps[index] && <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />}
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
              <Typography variant="body2" color="text.secondary">Editing existing building</Typography>
              <TextField fullWidth label="Name" value={initialData?.name || ''}
                onChange={(e) => setCurrentFormData(prev => ({ ...prev, name: e.target.value }))} size="small" />
              <TextField fullWidth label="Code" value={initialData?.code || ''} disabled size="small" />
              <Button variant="contained" onClick={handleUpdateLocation} disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}>
                Save Changes
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>

        {!isEdit && activeStep > 0 && !success && (
          <Button onClick={handleGoBack} disabled={loading} startIcon={<ArrowBackIcon />}>
            Back to {BUILDINGS_LEVELS[activeStep - 1]?.name}
          </Button>
        )}

        {!isEdit && Object.keys(hierarchy).length > 0 && !success && (
          <Button onClick={handleReset} disabled={loading} color="warning">Reset All</Button>
        )}

        {createMode && !isEdit && !success && (
          <>
            <Button onClick={() => { setCreateMode(false); setEditMode(false); setEditingLevel(null); setShowAddressSearch(false); }}
              disabled={loading}>
              Back to Selection
            </Button>
            <Button variant="contained"
              onClick={activeStep === 0 && selectedAddress
                ? handleSaveWithAddressLink
                : (editMode ? handleUpdateLocation : handleSaveNewLocation)}
              disabled={loading || !currentFormData.name || (editMode ? false : (!currentFormData.code || codeAvailable === false))}
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}>
              {editMode ? `Update ${currentLevel.name}` : `Save ${currentLevel.name}`}
            </Button>
          </>
        )}

        {success && <Button variant="contained" onClick={handleFinish}>Finish</Button>}
      </DialogActions>
    </Dialog>
  );
};

export default BuildingForm;