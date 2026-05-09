// src/components/admin/AdminStructures.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';

// Material-UI imports
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent,
  IconButton, Chip, Card, CardContent, Tooltip, Alert, Snackbar,
  CircularProgress, TextField, Select, MenuItem, FormControl,
  InputLabel, Checkbox, FormControlLabel, Grid, Divider, Paper,
  Stepper, Step, StepLabel, StepContent, Fade, Collapse,
  FormHelperText
} from '@mui/material';

// Icons
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Refresh as RefreshIcon, Business as BusinessIcon, Close as CloseIcon,
  Save as SaveIcon, Cancel as CancelIcon, AccountTree as AccountTreeIcon,
  CheckCircle as CheckCircleIcon, Warning as WarningIcon,
  DragIndicator as DragIndicatorIcon, OpenWith as OpenWithIcon
} from '@mui/icons-material';

// API Service
import { organizationAPI } from '../../services/api';

// ==================== Constants ====================

const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
const phoneRegex = /^\+?[\d\s-]{10,}$/;

// ==================== Helper Functions ====================

const formatErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred';
  if (typeof error === 'string') return error;
  
  if (Array.isArray(error)) {
    const messages = error.map(err => err.msg || err.message).filter(Boolean);
    if (messages.length) return messages.join(', ');
  }
  
  if (error.detail) {
    if (Array.isArray(error.detail)) {
      return error.detail.map(err => err.msg || err.message).join(', ');
    }
    return error.detail;
  }
  
  return error.message || error.error || 'Operation failed';
};

// ==================== Horizontal Draggable Tree Node Component ====================

const HorizontalTreeNode = ({ 
  node, 
  onEdit, 
  onAddChild, 
  onDelete, 
  onDragStart, 
  onDragOver, 
  onDrop, 
  onDragEnd,
  isDragging,
  isMoveInProgress,
  depth = 0
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isMoveInProgress) {
      setIsDragOver(true);
    }
    if (onDragOver) onDragOver(e, node);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isMoveInProgress && onDrop) {
      onDrop(e, node);
    }
  };

  const handleDragStart = (e) => {
    if (isMoveInProgress) {
      e.preventDefault();
      return false;
    }
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(e, node);
  };

  const handleDragEnd = (e) => {
    setIsDragOver(false);
    if (onDragEnd) onDragEnd(e);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      position: 'relative',
      minWidth: 250
    }}>
      {/* Node Card */}
      <Box
        draggable={!isMoveInProgress}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          opacity: isDragging ? 0.4 : 1,
          cursor: isMoveInProgress ? 'not-allowed' : 'grab',
          transition: 'opacity 0.2s',
          position: 'relative',
          '&:active': { cursor: isMoveInProgress ? 'not-allowed' : 'grabbing' }
        }}
      >
        {isDragOver && (
          <Box
            sx={{
              position: 'absolute',
              top: -4,
              left: 0,
              right: 0,
              height: 4,
              bgcolor: 'primary.main',
              borderRadius: 2,
              zIndex: 1,
              animation: 'pulse 1s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 }
              }
            }}
          />
        )}
        <Card sx={{ 
          width: 240,
          bgcolor: node.color || '#4A90E2',
          color: 'white',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
          position: 'relative'
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <DragIndicatorIcon sx={{ cursor: 'grab', opacity: 0.7 }} fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', flex: 1, fontSize: '0.9rem' }}>
                  {node.name}
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5, fontSize: '0.8rem' }}>
              {node.title}
            </Typography>
            {node.employee_count > 0 && (
              <Chip 
                label={`👥 ${node.employee_count}`}
                size="small"
                sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white', height: 20, fontSize: '0.7rem' }}
              />
            )}
            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', mt: 1 }}>
              <Tooltip title="Edit">
                <IconButton size="small" sx={{ color: 'white' }} onClick={() => onEdit('edit', node)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Add Child">
                <span>
                  <IconButton 
                    size="small" 
                    sx={{ color: 'white' }} 
                    onClick={() => onAddChild('create', node)}
                    disabled={isMoveInProgress}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete">
                <span>
                  <IconButton 
                    size="small" 
                    sx={{ color: 'white' }} 
                    onClick={() => onDelete(node)}
                    disabled={isMoveInProgress}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Children - Horizontal Layout */}
      {hasChildren && (
        <>
          {/* Connector Line */}
          <Box sx={{ 
            position: 'relative', 
            width: '100%', 
            height: 40,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 2,
              height: 40,
              bgcolor: '#ccc'
            }
          }} />
          
          {/* Children Container */}
          <Box sx={{ 
            display: 'flex', 
            gap: 4, 
            justifyContent: 'center',
            flexWrap: 'wrap',
            position: 'relative',
            pt: 2,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              bgcolor: '#ccc'
            }
          }}>
            {node.children.map(child => (
              <Box key={child.id} sx={{ position: 'relative' }}>
                {/* Vertical connector to parent */}
                <Box sx={{ 
                  position: 'absolute', 
                  top: -20, 
                  left: '50%', 
                  transform: 'translateX(-50%)',
                  width: 2, 
                  height: 20, 
                  bgcolor: '#ccc'
                }} />
                <HorizontalTreeNode
                  node={child}
                  onEdit={onEdit}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                  isDragging={isDragging}
                  isMoveInProgress={isMoveInProgress}
                  depth={depth + 1}
                />
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

// ==================== Form Field Component ====================

const FormField = ({ 
  label, type = 'text', value, onChange, error, options = [],
  required = false, min, placeholder, helperText, multiline = false,
  rows = 3
}) => {
  const handleChange = (e) => {
    const newValue = type === 'checkbox' ? e.target.checked : e.target.value;
    onChange(newValue);
  };

  const commonProps = {
    fullWidth: true,
    size: 'small',
    margin: 'normal',
    label,
    value: value || (type === 'checkbox' ? false : ''),
    onChange: handleChange,
    error: !!error,
    helperText: error || helperText,
    required,
    placeholder,
    multiline,
    rows: multiline ? rows : undefined
  };

  switch (type) {
    case 'select':
      const isValidValue = options.some(opt => String(opt.id) === String(value));
      const selectValue = (value && isValidValue) ? String(value) : '';
      
      return (
        <FormControl fullWidth size="small" margin="normal" error={!!error} required={required}>
          <InputLabel>{label}</InputLabel>
          <Select 
            value={selectValue} 
            onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)} 
            label={label}
          >
            <MenuItem value="">None</MenuItem>
            {options.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {opt.name}
              </MenuItem>
            ))}
          </Select>
          {helperText && !error && <FormHelperText>{helperText}</FormHelperText>}
        </FormControl>
      );
    
    case 'checkbox':
      return (
        <FormControlLabel
          control={<Checkbox checked={value || false} onChange={handleChange} />}
          label={label}
        />
      );
    
    case 'number':
      return <TextField {...commonProps} type="number" slotProps={{ htmlInput: { min } }} />;
    
    case 'color':
      return (
        <TextField 
          {...commonProps} 
          type="color" 
          sx={{ '& input': { cursor: 'pointer', padding: '0.5rem', height: 48 } }} 
        />
      );
    
    default:
      return <TextField {...commonProps} type={type} />;
  }
};

// ==================== Form Section Component ====================

const FormSection = ({ title, icon: Icon, children }) => (
  <Box sx={{ mb: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      {Icon && <Icon color="primary" />}
      <Typography variant="subtitle1" fontWeight="bold">
        {title}
      </Typography>
    </Box>
    <Divider sx={{ mb: 2 }} />
    <Grid container spacing={2}>
      {children}
    </Grid>
  </Box>
);

// ==================== Main Component ====================

export function AdminStructures() {
  // State
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedNode, setSelectedNode] = useState(null);
  const [parentOptions, setParentOptions] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeStep, setActiveStep] = useState(0);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [isMoveInProgress, setIsMoveInProgress] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', title: '', parent_id: '', email: '', phone: '',
    department_code: '', location: '', employee_count: 0, budget: 0,
    color: '#4A90E2', order: 0, is_active: true
  });
  
  const [errors, setErrors] = useState({});

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchTree(), fetchParentOptions()]);
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Failed to load organization data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTree = async () => {
    try {
      const response = await organizationAPI.getTree();
      const treeArray = Array.isArray(response) ? response : (response?.data || []);
      setTreeData(treeArray);
    } catch (error) {
      console.error('Error fetching tree:', error);
      setTreeData([]);
      throw error;
    }
  };

  const fetchParentOptions = async () => {
    try {
      const response = await organizationAPI.getAll();
      const nodesArray = Array.isArray(response) ? response : (response?.data || []);
      setParentOptions(nodesArray);
    } catch (error) {
      console.error('Error fetching parent options:', error);
      setParentOptions([]);
      throw error;
    }
  };

  const showNotification = (message, severity = 'success') => {
    const displayMessage = typeof message === 'object' ? formatErrorMessage(message) : message;
    setSnackbar({ open: true, message: displayMessage, severity });
  };

  // ==================== Drag and Drop Handlers ====================

  const findNodeById = useCallback((nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const isDescendant = useCallback((node, targetId) => {
    if (node.id === targetId) return true;
    if (node.children) {
      return node.children.some(child => isDescendant(child, targetId));
    }
    return false;
  }, []);

  const handleDragStart = useCallback((e, node) => {
    if (loading || isMoveInProgress) {
      e.preventDefault();
      return false;
    }
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedNodeId(node.id);
    return true;
  }, [loading, isMoveInProgress]);

  const handleDragOver = useCallback((e, node) => {
    e.preventDefault();
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedNodeId(null);
  }, []);

  const handleDrop = useCallback(async (e, targetNode) => {
    e.preventDefault();
    
    if (loading || isMoveInProgress) {
      showNotification('Please wait, another operation is in progress', 'warning');
      return;
    }
    
    const sourceNodeId = draggedNodeId || e.dataTransfer.getData('text/plain');
    
    if (!sourceNodeId) {
      return;
    }
    
    if (sourceNodeId === targetNode.id) {
      showNotification('Cannot drop a node onto itself', 'warning');
      setDraggedNodeId(null);
      return;
    }
    
    // Check if move API exists
    if (typeof organizationAPI.move !== 'function') {
      showNotification('Move functionality is not available on the server', 'error');
      setDraggedNodeId(null);
      return;
    }
    
    // Check for circular reference
    const sourceNode = findNodeById(treeData, sourceNodeId);
    
    if (sourceNode && isDescendant(sourceNode, targetNode.id)) {
      showNotification('Cannot move a parent node into its own child', 'error');
      setDraggedNodeId(null);
      return;
    }
    
    setIsMoveInProgress(true);
    setLoading(true);
    
    try {
      await organizationAPI.move(sourceNodeId, targetNode.id);
      showNotification(`Successfully moved to "${targetNode.name}"`, 'success');
      await loadData();
    } catch (error) {
      console.error('Move error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to move department';
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
      setIsMoveInProgress(false);
      setDraggedNodeId(null);
    }
  }, [draggedNodeId, treeData, loading, isMoveInProgress, findNodeById, isDescendant, loadData]);

  // ==================== Form Handlers ====================

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = 'Department name is required';
    if (!formData.title?.trim()) newErrors.title = 'Position title is required';
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (formData.phone && !phoneRegex.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number (minimum 10 digits)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleFieldChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  const handleNext = useCallback(() => {
    if (activeStep === 0 && (!formData.name || !formData.title)) {
      showNotification('Please fill in department name and position title', 'error');
      return;
    }
    setActiveStep(prev => prev + 1);
  }, [activeStep, formData.name, formData.title]);

  const handleBack = useCallback(() => {
    setActiveStep(prev => prev - 1);
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: '', title: '', parent_id: '', email: '', phone: '',
      department_code: '', location: '', employee_count: 0, budget: 0,
      color: '#4A90E2', order: 0, is_active: true
    });
    setErrors({});
    setActiveStep(0);
    setSelectedNode(null);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    resetForm();
  }, [resetForm]);

  const handleOpenDialog = useCallback((mode, node = null) => {
    setDialogMode(mode);
    setSelectedNode(node);
    setActiveStep(0);
    
    if (mode === 'edit' && node) {
      setFormData({
        name: node.name || '',
        title: node.title || '',
        parent_id: node.parent_id || '',
        email: node.email || '',
        phone: node.phone || '',
        department_code: node.department_code || '',
        location: node.location || '',
        employee_count: node.employee_count || 0,
        budget: node.budget || 0,
        color: node.color || '#4A90E2',
        order: node.order || 0,
        is_active: node.is_active !== false
      });
    } else if (mode === 'create') {
      setFormData(prev => ({
        ...prev,
        parent_id: node?.id || '',
        name: '',
        title: '',
        email: '',
        phone: '',
        department_code: '',
        location: '',
        employee_count: 0,
        budget: 0,
        color: '#4A90E2',
        order: 0,
        is_active: true
      }));
    }
    
    setErrors({});
    setDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      showNotification('Please fix the errors in the form', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const submitData = {
        name: formData.name.trim(),
        title: formData.title.trim(),
        parent_id: (!formData.parent_id || formData.parent_id === '' || formData.parent_id === 'null') 
          ? null : formData.parent_id,
        order: parseInt(formData.order, 10) || 0,
        employee_count: parseInt(formData.employee_count, 10) || 0,
        budget: parseFloat(formData.budget) || 0,
        color: formData.color || '#4A90E2',
        is_active: formData.is_active !== false,
        ...(formData.email && { email: formData.email }),
        ...(formData.phone && { phone: formData.phone }),
        ...(formData.department_code && { department_code: formData.department_code }),
        ...(formData.location && { location: formData.location })
      };
      
      if (dialogMode === 'create') {
        await organizationAPI.create(submitData);
        showNotification('Department created successfully');
      } else if (dialogMode === 'edit') {
        if (!selectedNode || !selectedNode.id) {
          throw new Error('Selected node not found for edit operation');
        }
        await organizationAPI.update(selectedNode.id, submitData);
        showNotification('Department updated successfully');
      }
      
      handleCloseDialog();
      await loadData();
    } catch (error) {
      console.error('Submit error:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Operation failed';
      showNotification(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [validateForm, formData, dialogMode, selectedNode, handleCloseDialog]);

  const handleDelete = useCallback(async (node) => {
    if (!node) {
      showNotification('No department selected for deletion', 'error');
      return;
    }
    
    if (isMoveInProgress) {
      showNotification('Please wait for current operation to complete', 'warning');
      return;
    }
    
    if (!window.confirm(`⚠️ Delete "${node.name}" and all its sub-departments? This action cannot be undone!`)) {
      return;
    }
    
    setLoading(true);
    try {
      await organizationAPI.delete(node.id);
      showNotification('Department deleted successfully');
      if (dialogOpen) handleCloseDialog();
      await loadData();
    } catch (error) {
      console.error('Delete error:', error);
      showNotification('Failed to delete department', 'error');
    } finally {
      setLoading(false);
    }
  }, [dialogOpen, handleCloseDialog, isMoveInProgress, loadData]);

  // ==================== Render Tree ====================

  const renderTree = useCallback(() => {
    if (!treeData || !Array.isArray(treeData)) {
      return <Typography>No data available</Typography>;
    }
    
    if (treeData.length === 0) {
      return (
        <Alert 
          severity="info" 
          icon={<BusinessIcon />}
          action={
            <Button color="inherit" size="small" onClick={() => handleOpenDialog('create')}>
              Create One
            </Button>
          }
        >
          No departments found. Click "Add Root Department" to get started.
        </Alert>
      );
    }
    
    return (
      <Box sx={{ 
        display: 'flex', 
        gap: 6, 
        justifyContent: 'center', 
        alignItems: 'flex-start',
        flexWrap: 'wrap'
      }}>
        {treeData.map(node => (
          <HorizontalTreeNode
            key={node.id}
            node={node}
            onEdit={handleOpenDialog}
            onAddChild={handleOpenDialog}
            onDelete={handleDelete}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            isDragging={draggedNodeId === node.id}
            isMoveInProgress={isMoveInProgress}
          />
        ))}
      </Box>
    );
  }, [treeData, handleOpenDialog, handleDelete, handleDragStart, handleDragOver, handleDrop, handleDragEnd, draggedNodeId, isMoveInProgress]);

  // Loading state
  if (loading && treeData.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ==================== Main Render ====================
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <BusinessIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h5" fontWeight="bold">Organization Structure</Typography>
            <Chip label={`${treeData.length} Root Departments`} size="small" variant="outlined" />
            <Chip 
              icon={<OpenWithIcon />} 
              label="Drag & Drop to Reorganize" 
              size="small" 
              color="info" 
              variant="outlined"
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <span>
                <IconButton onClick={loadData} disabled={loading || isMoveInProgress}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => handleOpenDialog('create')}
              disabled={isMoveInProgress}
            >
              Add Root Department
            </Button>
          </Box>
        </Box>
        
        {/* Drag & Drop Instructions */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            💡 <strong>Horizontal Tree View:</strong> Drag any department card and drop it onto another department to reorganize the hierarchy.
            The tree structure flows horizontally from top to bottom. Drop a node onto another to make it a child.
          </Typography>
        </Alert>
      </Paper>

      {/* Tree View - Horizontal Layout */}
      <Paper sx={{ p: 3, overflowX: 'auto', minHeight: '500px' }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
          <AccountTreeIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
          Organization Hierarchy (Horizontal Tree Layout - Drag cards onto targets to reorganize)
        </Typography>
        {renderTree()}
      </Paper>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {dialogMode === 'create' 
                ? (selectedNode ? `➕ Add Child to "${selectedNode.name}"` : '🏢 Create New Department')
                : `✏️ Edit "${selectedNode?.name}"`
              }
            </Typography>
            <IconButton onClick={handleCloseDialog} disabled={loading}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Fade in={dialogOpen}>
            <Box sx={{ mt: 2 }}>
              <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 3 }}>
                {/* Step 1: Basic Information */}
                <Step>
                  <StepLabel>Basic Information</StepLabel>
                  <StepContent>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12 }}>
                        <FormField
                          label="Department Name *"
                          value={formData.name}
                          onChange={(v) => handleFieldChange('name', v)}
                          error={errors.name}
                          required
                          placeholder="e.g., Engineering Department"
                          helperText="Official department or team name"
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <FormField
                          label="Position Title *"
                          value={formData.title}
                          onChange={(v) => handleFieldChange('title', v)}
                          error={errors.title}
                          required
                          placeholder="e.g., Director, Manager, Team Lead"
                          helperText="The leadership position for this department"
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <FormField
                          type="select"
                          label="Parent Department"
                          value={formData.parent_id}
                          onChange={(v) => handleFieldChange('parent_id', v)}
                          options={parentOptions.filter(p => p.id !== selectedNode?.id)}
                          helperText="Select parent department (leave empty for top level)"
                        />
                      </Grid>
                    </Grid>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                      <Button onClick={handleNext} variant="contained" disabled={loading}>
                        Next
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
                
                {/* Step 2: Contact Information */}
                <Step>
                  <StepLabel>Contact Information</StepLabel>
                  <StepContent>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormField 
                          type="email" 
                          label="Email Address" 
                          value={formData.email} 
                          onChange={(v) => handleFieldChange('email', v)} 
                          error={errors.email}
                          placeholder="department@company.com"
                          helperText="Official department email"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormField 
                          label="Phone Number" 
                          value={formData.phone} 
                          onChange={(v) => handleFieldChange('phone', v)}
                          error={errors.phone}
                          placeholder="+1-234-567-8900"
                          helperText="Include country code"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormField 
                          label="Department Code" 
                          value={formData.department_code} 
                          onChange={(v) => handleFieldChange('department_code', v)}
                          placeholder="e.g., ENG-01"
                          helperText="Unique identifier for the department"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormField 
                          label="Location" 
                          value={formData.location} 
                          onChange={(v) => handleFieldChange('location', v)}
                          placeholder="Building, Floor, Room"
                          helperText="Physical location of the department"
                        />
                      </Grid>
                    </Grid>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                      <Button onClick={handleBack} disabled={loading}>Back</Button>
                      <Button onClick={handleNext} variant="contained" disabled={loading}>
                        Next
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
                
                {/* Step 3: Statistics & Customization */}
                <Step>
                  <StepLabel>Statistics & Customization</StepLabel>
                  <StepContent>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormField 
                          type="number" 
                          label="Employee Count" 
                          value={formData.employee_count} 
                          onChange={(v) => handleFieldChange('employee_count', v)} 
                          min={0}
                          helperText="Number of employees in this department"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormField 
                          type="number" 
                          label="Annual Budget ($)" 
                          value={formData.budget} 
                          onChange={(v) => handleFieldChange('budget', v)} 
                          min={0}
                          placeholder="0"
                          helperText="Department's annual budget in USD"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormField 
                          type="color" 
                          label="Department Color" 
                          value={formData.color} 
                          onChange={(v) => handleFieldChange('color', v)}
                          helperText="Color used to identify this department"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormField 
                          type="number" 
                          label="Display Order" 
                          value={formData.order} 
                          onChange={(v) => handleFieldChange('order', v)} 
                          min={0}
                          helperText="Lower numbers appear first in the tree"
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <FormField 
                          type="checkbox" 
                          label="Active Department" 
                          value={formData.is_active} 
                          onChange={(v) => handleFieldChange('is_active', v)}
                        />
                      </Grid>
                    </Grid>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                      <Button onClick={handleBack} disabled={loading}>Back</Button>
                      <Button 
                        onClick={handleSubmit} 
                        variant="contained" 
                        color="primary" 
                        startIcon={<SaveIcon />} 
                        disabled={loading}
                      >
                        {dialogMode === 'create' ? 'Create Department' : 'Save Changes'}
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              </Stepper>
              
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                <Button onClick={handleCloseDialog} startIcon={<CancelIcon />} disabled={loading}>
                  Cancel
                </Button>
                {dialogMode === 'edit' && selectedNode && (
                  <Button 
                    color="error" 
                    onClick={() => handleDelete(selectedNode)} 
                    startIcon={<DeleteIcon />} 
                    variant="outlined"
                    disabled={loading || isMoveInProgress}
                  >
                    Delete Department
                  </Button>
                )}
              </Box>
            </Box>
          </Fade>
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          icon={snackbar.severity === 'success' ? <CheckCircleIcon /> : <WarningIcon />}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default AdminStructures;