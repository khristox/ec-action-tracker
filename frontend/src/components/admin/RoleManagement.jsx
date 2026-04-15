import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  AddOutlined,
  EditOutlined,
  DeleteOutlined,
  SecurityOutlined,
  VerifiedUserOutlined,
  GroupOutlined,
  ExpandMore,
  SaveOutlined,
  CancelOutlined,
  CheckCircleOutline,
  CloseOutlined,
  ShieldOutlined,
  PersonAddOutlined,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { 
  fetchRoles, 
  createRole, 
  updateRole, 
  deleteRole, 
  fetchPermissions,
  assignPermissions 
} from '../../store/slices/roleSlice';

const RoleManagement = () => {
  const dispatch = useDispatch();
  const { roles, permissions, isLoading, error } = useSelector((state) => state.roles);
  const { user: currentUser } = useSelector((state) => state.auth);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create', 'edit', 'delete', 'permissions'
  const [selectedRole, setSelectedRole] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [activeTab, setActiveTab] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  // Load roles and permissions on mount
  useEffect(() => {
    loadRoles();
    loadPermissions();
  }, []);

  const loadRoles = () => {
    dispatch(fetchRoles());
  };

  const loadPermissions = () => {
    dispatch(fetchPermissions());
  };

  const handleOpenCreateDialog = () => {
    setDialogMode('create');
    setFormData({
      name: '',
      code: '',
      description: '',
      is_active: true,
    });
    setSelectedPermissions([]);
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (role) => {
    setDialogMode('edit');
    setSelectedRole(role);
    setFormData({
      name: role.name,
      code: role.code,
      description: role.description || '',
      is_active: role.is_active,
    });
    setSelectedPermissions(role.permissions?.map(p => p.id) || []);
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenPermissionsDialog = (role) => {
    setDialogMode('permissions');
    setSelectedRole(role);
    setSelectedPermissions(role.permissions?.map(p => p.id) || []);
    setDialogOpen(true);
  };

  const handleOpenDeleteDialog = (role) => {
    setDialogMode('delete');
    setSelectedRole(role);
    setDialogOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-generate code from name for create mode
    if (dialogMode === 'create' && name === 'name') {
      const code = value.toLowerCase().replace(/\s+/g, '_');
      setFormData(prev => ({ ...prev, code }));
    }
    
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePermissionToggle = (permissionId) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name) errors.name = 'Role name is required';
    if (!formData.code) errors.code = 'Role code is required';
    else if (!/^[a-z_]+$/.test(formData.code)) errors.code = 'Code must be lowercase letters and underscores only';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (dialogMode === 'create') {
      if (!validateForm()) return;
      
      try {
        const result = await dispatch(createRole({
          ...formData,
          permission_ids: selectedPermissions,
        })).unwrap();
        
        setSnackbarMessage('Role created successfully');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        setDialogOpen(false);
        loadRoles();
      } catch (err) {
        setSnackbarMessage(err.detail?.message || 'Failed to create role');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } else if (dialogMode === 'edit') {
      if (!validateForm()) return;
      
      try {
        await dispatch(updateRole({
          id: selectedRole.id,
          ...formData,
        })).unwrap();
        
        setSnackbarMessage('Role updated successfully');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        setDialogOpen(false);
        loadRoles();
      } catch (err) {
        setSnackbarMessage(err.detail?.message || 'Failed to update role');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } else if (dialogMode === 'permissions') {
      try {
        await dispatch(assignPermissions({
          role_id: selectedRole.id,
          permission_ids: selectedPermissions,
        })).unwrap();
        
        setSnackbarMessage('Permissions updated successfully');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        setDialogOpen(false);
        loadRoles();
      } catch (err) {
        setSnackbarMessage(err.detail?.message || 'Failed to update permissions');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } else if (dialogMode === 'delete') {
      try {
        await dispatch(deleteRole(selectedRole.id)).unwrap();
        
        setSnackbarMessage('Role deleted successfully');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        setDialogOpen(false);
        loadRoles();
      } catch (err) {
        setSnackbarMessage(err.detail?.message || 'Failed to delete role');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // Group permissions by category
  const groupedPermissions = permissions.reduce((groups, permission) => {
    const category = permission.category || 'General';
    if (!groups[category]) groups[category] = [];
    groups[category].push(permission);
    return groups;
  }, {});

  // Table columns
  const columns = [
    { field: 'id', headerName: 'ID', width: 90, hide: true },
    {
      field: 'name',
      headerName: 'Role Name',
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShieldOutlined color={params.row.code === 'admin' ? 'error' : 'primary'} />
          <Typography fontWeight={500}>{params.row.name}</Typography>
        </Box>
      ),
    },
    {
      field: 'code',
      headerName: 'Code',
      width: 150,
      renderCell: (params) => (
        <Chip label={params.row.code} size="small" variant="outlined" />
      ),
    },
    {
      field: 'description',
      headerName: 'Description',
      width: 300,
      renderCell: (params) => params.row.description || '—',
    },
    {
      field: 'permissions',
      headerName: 'Permissions',
      width: 300,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {(params.row.permissions || []).slice(0, 3).map((perm) => (
            <Chip
              key={perm.id}
              label={perm.code}
              size="small"
              variant="outlined"
            />
          ))}
          {(params.row.permissions || []).length > 3 && (
            <Chip
              label={`+${params.row.permissions.length - 3}`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      ),
    },
    {
      field: 'user_count',
      headerName: 'Users',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.row.user_count || 0}
          size="small"
          icon={<GroupOutlined />}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.row.is_active ? 'Active' : 'Inactive'}
          size="small"
          color={params.row.is_active ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit Role">
            <IconButton size="small" onClick={() => handleOpenEditDialog(params.row)}>
              <EditOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Manage Permissions">
            <IconButton size="small" onClick={() => handleOpenPermissionsDialog(params.row)}>
              <SecurityOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          {params.row.code !== 'admin' && params.row.code !== 'user' && (
            <Tooltip title="Delete Role">
              <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog(params.row)}>
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  // Stats cards
  const stats = {
    total: roles?.length || 0,
    active: roles?.filter(r => r.is_active).length || 0,
    totalPermissions: permissions?.length || 0,
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Role Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage system roles and permissions
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Roles
              </Typography>
              <Typography variant="h4">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Active Roles
              </Typography>
              <Typography variant="h4" color="success.main">{stats.active}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Permissions
              </Typography>
              <Typography variant="h4" color="info.main">{stats.totalPermissions}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Actions */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Roles List</Typography>
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={handleOpenCreateDialog}
        >
          Create Role
        </Button>
      </Paper>

      {/* Roles Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Box sx={{ height: 500, width: '100%' }}>
          <DataGrid
            rows={roles || []}
            columns={columns}
            loading={isLoading}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
              sorting: { sortModel: [{ field: 'name', sort: 'asc' }] },
            }}
            disableRowSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid',
                borderColor: 'divider',
              },
            }}
          />
        </Box>
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'create' && 'Create New Role'}
          {dialogMode === 'edit' && `Edit Role: ${selectedRole?.name}`}
          {dialogMode === 'permissions' && `Manage Permissions: ${selectedRole?.name}`}
          {dialogMode === 'delete' && 'Confirm Delete'}
        </DialogTitle>
        <DialogContent>
          {(dialogMode === 'create' || dialogMode === 'edit') && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Role Name"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Role Code"
                  name="code"
                  value={formData.code}
                  onChange={handleFormChange}
                  error={!!formErrors.code}
                  helperText={formErrors.code || 'Lowercase letters and underscores only'}
                  required
                  disabled={dialogMode === 'edit' && selectedRole?.code === 'admin'}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          )}

          {dialogMode === 'permissions' && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Select permissions for {selectedRole?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                {selectedPermissions.length} permissions selected
              </Typography>
              
              <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
                <Tab label="Group by Category" />
                <Tab label="All Permissions" />
              </Tabs>
              
              {activeTab === 0 ? (
                // Grouped by category
                Object.entries(groupedPermissions).map(([category, perms]) => (
                  <Accordion key={category} defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle1">{category}</Typography>
                      <Chip 
                        label={`${perms.filter(p => selectedPermissions.includes(p.id)).length}/${perms.length}`}
                        size="small"
                        sx={{ ml: 2 }}
                      />
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={1}>
                        {perms.map((permission) => (
                          <Grid item xs={12} sm={6} md={4} key={permission.id}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={selectedPermissions.includes(permission.id)}
                                  onChange={() => handlePermissionToggle(permission.id)}
                                />
                              }
                              label={
                                <Box>
                                  <Typography variant="body2">{permission.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {permission.code}
                                  </Typography>
                                </Box>
                              }
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                ))
              ) : (
                // Flat list
                <Grid container spacing={1}>
                  {permissions.map((permission) => (
                    <Grid item xs={12} sm={6} md={4} key={permission.id}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedPermissions.includes(permission.id)}
                            onChange={() => handlePermissionToggle(permission.id)}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">{permission.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {permission.code}
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {dialogMode === 'delete' && (
            <Typography sx={{ mt: 2 }}>
              Are you sure you want to delete role <strong>{selectedRole?.name}</strong>? 
              This action cannot be undone.
              {selectedRole?.user_count > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This role is assigned to {selectedRole.user_count} user(s). Deleting it may affect their permissions.
                </Alert>
              )}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color={dialogMode === 'delete' ? 'error' : 'primary'}
            startIcon={dialogMode === 'permissions' ? <SaveOutlined /> : null}
          >
            {dialogMode === 'create' && 'Create'}
            {dialogMode === 'edit' && 'Save Changes'}
            {dialogMode === 'permissions' && 'Save Permissions'}
            {dialogMode === 'delete' && 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} variant="filled">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default RoleManagement;