// src/components/admin/adminStructures.jsx
import React, { useState, useEffect } from 'react';

// Material-UI imports - use proper imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';

// Icons
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import BusinessIcon from '@mui/icons-material/Business';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

// API Service
import { organizationAPI } from '../../services/api';

// Custom Tree Component (no external dependencies)
const TreeNode = ({ children, label }) => {
  const hasChildren = children && React.Children.count(children) > 0;
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={{ mb: 1 }}>{label}</Box>
      {hasChildren && (
        <Box sx={{ position: 'relative', mt: 2 }}>
          <Box sx={{ 
            position: 'absolute', 
            top: -12, 
            left: '50%', 
            transform: 'translateX(-50%)',
            width: 2, 
            height: 12, 
            bgcolor: '#1890ff' 
          }} />
          <Box sx={{ 
            display: 'flex', 
            gap: 4, 
            justifyContent: 'center',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -12,
              left: 0,
              right: 0,
              height: 2,
              bgcolor: '#1890ff'
            }
          }}>
            {React.Children.map(children, (child) => (
              <Box key={child.key} sx={{ position: 'relative' }}>
                <Box sx={{ 
                  position: 'absolute', 
                  top: -12, 
                  left: '50%', 
                  transform: 'translateX(-50%)',
                  width: 2, 
                  height: 12, 
                  bgcolor: '#1890ff' 
                }} />
                {child}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

const Tree = ({ children }) => (
  <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', overflowX: 'auto' }}>
    {children}
  </Box>
);

// Form Field Component - Fixed to use correct MUI props
const FormField = ({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  error, 
  options = [],
  required = false,
  min,
  placeholder 
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
    helperText: error,
    required,
    placeholder
  };

  switch (type) {
    case 'select':
      return (
        <FormControl fullWidth size="small" margin="normal" error={!!error} required={required}>
          <InputLabel>{label}</InputLabel>
          <Select value={value || ''} onChange={handleChange} label={label}>
            <MenuItem value="">None</MenuItem>
            {options.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
            ))}
          </Select>
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
      return (
        <TextField
          {...commonProps}
          type="number"
          slotProps={{ htmlInput: { min } }}
        />
      );
    
    case 'color':
      return (
        <TextField
          {...commonProps}
          type="color"
          sx={{ '& input': { cursor: 'pointer', padding: '0.5rem' } }}
        />
      );
    
    default:
      return <TextField {...commonProps} type={type} />;
  }
};

// Main Component
export function AdminStructures() {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedNode, setSelectedNode] = useState(null);
  const [parentOptions, setParentOptions] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    parent_id: '',
    email: '',
    phone: '',
    department_code: '',
    location: '',
    employee_count: 0,
    budget: 0,
    color: '#4A90E2',
    order: 0,
    is_active: true
  });
  
  const [errors, setErrors] = useState({});

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
      setTreeData(response.data || []);
    } catch (error) {
      console.error('Error fetching tree:', error);
      setTreeData([]);
    }
  };

  const fetchParentOptions = async () => {
    try {
      const response = await organizationAPI.getAll();
      setParentOptions(response.data || []);
    } catch (error) {
      console.error('Error fetching parent options:', error);
      setParentOptions([]);
    }
  };

  const showNotification = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.title) newErrors.title = 'Title is required';
    if (formData.email && !/^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleOpenDialog = (mode, node = null) => {
    setDialogMode(mode);
    setSelectedNode(node);
    
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
    } else {
      setFormData({
        name: '',
        title: '',
        parent_id: node?.id || '',
        email: '',
        phone: '',
        department_code: '',
        location: '',
        employee_count: 0,
        budget: 0,
        color: '#4A90E2',
        order: 0,
        is_active: true
      });
    }
    
    setErrors({});
    setDialogOpen(true);
  };

// src/components/admin/adminStructures.jsx - Update handleSubmit

const handleSubmit = async () => {
  if (!validateForm()) {
    showNotification('Please fix the errors in the form', 'error');
    return;
  }
  
  setLoading(true);
  try {
    // Prepare data - convert empty parent_id to null
    const submitData = {
      ...formData,
      parent_id: formData.parent_id === '' || formData.parent_id === undefined 
        ? null 
        : parseInt(formData.parent_id, 10),
      employee_count: parseInt(formData.employee_count, 10) || 0,
      budget: parseFloat(formData.budget) || 0,
      order: parseInt(formData.order, 10) || 0
    };
    
    if (dialogMode === 'create') {
      await organizationAPI.create(submitData);
      showNotification('Department created successfully');
    } else {
      await organizationAPI.update(selectedNode.id, submitData);
      showNotification('Department updated successfully');
    }
    setDialogOpen(false);
    await loadData();
  } catch (error) {
    showNotification(error.response?.data?.error || 'Operation failed', 'error');
  } finally {
    setLoading(false);
  }
};

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${selectedNode?.name}" and all sub-departments?`)) return;
    
    setLoading(true);
    try {
      await organizationAPI.delete(selectedNode.id);
      showNotification('Department deleted successfully');
      setDialogOpen(false);
      await loadData();
    } catch (error) {
      showNotification('Failed to delete department', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderTreeNode = (node) => {
    if (!node) return null;
    
    return (
      <TreeNode key={node.id} label={
        <Card sx={{ 
          minWidth: 200, 
          maxWidth: 250, 
          bgcolor: node.color || '#4A90E2',
          color: 'white',
          cursor: 'pointer',
          transition: 'transform 0.2s',
          '&:hover': { transform: 'scale(1.02)' }
        }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {node.name}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {node.title}
            </Typography>
            {node.employee_count > 0 && (
              <Chip 
                label={`👥 ${node.employee_count}`}
                size="small"
                sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
            )}
            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mt: 1 }}>
              <Tooltip title="Edit">
                <IconButton size="small" sx={{ color: 'white' }} onClick={() => handleOpenDialog('edit', node)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Add Child">
                <IconButton size="small" sx={{ color: 'white' }} onClick={() => handleOpenDialog('create', node)}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" sx={{ color: 'white' }} onClick={() => {
                  setSelectedNode(node);
                  handleDelete();
                }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </CardContent>
        </Card>
      }>
        {node.children && node.children.map(child => renderTreeNode(child))}
      </TreeNode>
    );
  };

  if (loading && treeData.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">
          <BusinessIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Organization Structure
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={loadData} sx={{ mr: 1 }} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog('create')}>
            Add Root Department
          </Button>
        </Box>
      </Paper>

      {/* Tree View */}
      {treeData.length === 0 ? (
        <Alert severity="info">
          No departments found. Click "Add Root Department" to get started.
        </Alert>
      ) : (
        <Paper sx={{ p: 3, overflowX: 'auto', minHeight: '500px' }}>
          <Tree>
            {treeData.map(node => renderTreeNode(node))}
          </Tree>
        </Paper>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {dialogMode === 'create' 
                ? (selectedNode ? `Add Child to ${selectedNode.name}` : 'Create Root Department')
                : `Edit ${selectedNode?.name}`
              }
            </Typography>
            <IconButton onClick={() => setDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold">Basic Information</Typography>
                <Divider sx={{ my: 1 }} />
              </Grid>
              
              <Grid item xs={12}>
                <FormField
                  label="Department Name"
                  value={formData.name}
                  onChange={(v) => handleFieldChange('name', v)}
                  error={errors.name}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormField
                  label="Position Title"
                  value={formData.title}
                  onChange={(v) => handleFieldChange('title', v)}
                  error={errors.title}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormField
                  type="select"
                  label="Parent Department"
                  value={formData.parent_id}
                  onChange={(v) => handleFieldChange('parent_id', v)}
                  options={parentOptions.filter(p => p.id !== selectedNode?.id)}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 1 }}>Contact Information</Typography>
                <Divider sx={{ my: 1 }} />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormField
                  type="email"
                  label="Email"
                  value={formData.email}
                  onChange={(v) => handleFieldChange('email', v)}
                  error={errors.email}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormField
                  label="Phone"
                  value={formData.phone}
                  onChange={(v) => handleFieldChange('phone', v)}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 1 }}>Statistics</Typography>
                <Divider sx={{ my: 1 }} />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormField
                  type="number"
                  label="Employee Count"
                  value={formData.employee_count}
                  onChange={(v) => handleFieldChange('employee_count', v)}
                  min={0}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormField
                  type="number"
                  label="Budget ($)"
                  value={formData.budget}
                  onChange={(v) => handleFieldChange('budget', v)}
                  min={0}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 1 }}>Customization</Typography>
                <Divider sx={{ my: 1 }} />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormField
                  type="color"
                  label="Node Color"
                  value={formData.color}
                  onChange={(v) => handleFieldChange('color', v)}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormField
                  type="number"
                  label="Display Order"
                  value={formData.order}
                  onChange={(v) => handleFieldChange('order', v)}
                  min={0}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormField
                  type="checkbox"
                  label="Active"
                  value={formData.is_active}
                  onChange={(v) => handleFieldChange('is_active', v)}
                />
              </Grid>
            </Grid>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
              <Button onClick={() => setDialogOpen(false)} startIcon={<CancelIcon />}>
                Cancel
              </Button>
              {dialogMode === 'edit' && (
                <Button color="error" onClick={handleDelete} startIcon={<DeleteIcon />}>
                  Delete
                </Button>
              )}
              <Button variant="contained" onClick={handleSubmit} startIcon={<SaveIcon />} disabled={loading}>
                {dialogMode === 'create' ? 'Create' : 'Save'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default AdminStructures;