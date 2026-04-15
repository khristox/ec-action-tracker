import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
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
  Stack,
  Divider,
  useTheme,
  useMediaQuery,
  CardActions,
  Collapse,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Badge,
} from '@mui/material';
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  LockOpenOutlined,
  VerifiedUserOutlined,
  PersonAddOutlined,
  EmailOutlined,
  PhoneOutlined,
  ExpandMore,
  ExpandLess,
  RefreshOutlined,
  AdminPanelSettingsOutlined,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { fetchUsers, createUser, updateUser, deleteUser, resetUserPassword, updateUserRoles } from '../../store/slices/adminSlice';
import { fetchRoles, selectAllRoles, selectRolesLoading } from '../../store/slices/roleSlice';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const UserManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const dispatch = useDispatch();
  const { users, isLoading, total } = useSelector((state) => state.admin);
  const { user: currentUser } = useSelector((state) => state.auth);
  const rolesList = useSelector(selectAllRoles);
  const rolesLoading = useSelector(selectRolesLoading);

  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 5 : 10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [expandedUser, setExpandedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    first_name: '',
    last_name: '',
    phone: '',
    roles: [],
    is_active: true,
    is_verified: false,
  });
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirm_password: '',
  });
  const [formErrors, setFormErrors] = useState({});

  // Fetch roles on component mount
  useEffect(() => {
    dispatch(fetchRoles());
  }, [dispatch]);

  // Load users
  const loadUsers = useCallback(() => {
    dispatch(fetchUsers({
      page: page + 1,
      limit: rowsPerPage,
      search: searchTerm,
      is_active: statusFilter !== 'all' ? statusFilter === 'active' : undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
    }));
  }, [dispatch, page, rowsPerPage, searchTerm, statusFilter, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Handlers
  const handlePageChange = (newPage) => setPage(newPage);
  const handleRowsPerPageChange = (newSize) => {
    setRowsPerPage(newSize);
    setPage(0);
  };
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };
  const handleRefresh = () => {
    loadUsers();
    dispatch(fetchRoles());
    setSnackbar({ open: true, message: 'Data refreshed', severity: 'success' });
  };

  // Dialog handlers
  const handleOpenCreateDialog = () => {
    setDialogMode('create');
    setFormData({
      email: '',
      username: '',
      first_name: '',
      last_name: '',
      phone: '',
      roles: [],
      is_active: true,
      is_verified: false,
    });
    setPasswordData({ password: '', confirm_password: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (user) => {
    setDialogMode('edit');
    setSelectedUser(user);
    setFormData({
      email: user.email,
      username: user.username,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      roles: [...(user.roles || [])], // Create new array copy
      is_active: user.is_active,
      is_verified: user.is_verified,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenDeleteDialog = (user) => {
    setDialogMode('delete');
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleOpenResetDialog = (user) => {
    setDialogMode('reset');
    setSelectedUser(user);
    setPasswordData({ password: '', confirm_password: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  // Form handlers
// Update the handleFormChange function to handle switches properly
const handleFormChange = (e) => {
  const { name, value, type, checked } = e.target;
  
  // Handle checkbox/switch inputs
  if (type === 'checkbox') {
    setFormData(prev => ({ ...prev, [name]: checked }));
  } else {
    setFormData(prev => ({ ...prev, [name]: value }));
  }
  
  if (formErrors[name]) {
    setFormErrors(prev => ({ ...prev, [name]: '' }));
  }
};
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Fixed: Create new array to avoid read-only issues
  const handleRoleChange = (event) => {
    const newRoles = [...event.target.value];
    setFormData(prev => ({ ...prev, roles: newRoles }));
  };

  const handleExpandUser = (userId) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  // Get role details
  const getRoleDetails = (roleCode) => {
    const role = rolesList?.find(r => r.code === roleCode);
    return {
      name: role?.name || roleCode,
      color: roleCode === 'admin' ? 'error' : roleCode === 'property_manager' ? 'warning' : 'primary',
      description: role?.description || '',
    };
  };

  // Validation
  const validateCreateForm = () => {
    const errors = {};
    
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Email is invalid';
    
    if (!formData.username) errors.username = 'Username is required';
    else if (formData.username.length < 3) errors.username = 'Username must be at least 3 characters';
    
    if (!passwordData.password) errors.password = 'Password is required';
    else if (passwordData.password.length < 8) errors.password = 'Password must be at least 8 characters';
    
    if (passwordData.password !== passwordData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateEditForm = () => {
    const errors = {};
    
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Email is invalid';
    
    if (!formData.username) errors.username = 'Username is required';
    else if (formData.username.length < 3) errors.username = 'Username must be at least 3 characters';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateResetForm = () => {
    const errors = {};
    
    if (!passwordData.password) errors.password = 'New password is required';
    else if (passwordData.password.length < 8) errors.password = 'Password must be at least 8 characters';
    
    if (passwordData.password !== passwordData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit handlers
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (dialogMode === 'create') {
        if (!validateCreateForm()) {
          setIsSubmitting(false);
          return;
        }
        await dispatch(createUser({ ...formData, password: passwordData.password })).unwrap();
        setSnackbar({ open: true, message: 'User created successfully', severity: 'success' });
        setDialogOpen(false);
        loadUsers();
      } else if (dialogMode === 'edit') {
        if (!validateEditForm()) {
          setIsSubmitting(false);
          return;
        }
        
        // Update basic info
        const updateData = {
          email: formData.email,
          username: formData.username,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          is_active: formData.is_active,
          is_verified: formData.is_verified,
        };
        
        await dispatch(updateUser({ id: selectedUser.id, ...updateData })).unwrap();
        
        // Update roles separately if they changed
        const currentRoles = [...(selectedUser.roles || [])].sort();
        const newRoles = [...(formData.roles || [])].sort();
        
        if (JSON.stringify(currentRoles) !== JSON.stringify(newRoles)) {
          await dispatch(updateUserRoles({ 
            id: selectedUser.id, 
            roles: [...newRoles]
          })).unwrap();
        }
        
        setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' });
        setDialogOpen(false);
        loadUsers();
      } else if (dialogMode === 'delete') {
        await dispatch(deleteUser(selectedUser.id)).unwrap();
        setSnackbar({ open: true, message: 'User deleted successfully', severity: 'success' });
        setDialogOpen(false);
        loadUsers();
      } else if (dialogMode === 'reset') {
        if (!validateResetForm()) {
          setIsSubmitting(false);
          return;
        }
        await dispatch(resetUserPassword({ 
          user_id: selectedUser.id, 
          new_password: passwordData.password 
        })).unwrap();
        setSnackbar({ open: true, message: 'Password reset successfully', severity: 'success' });
        setDialogOpen(false);
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message || `Failed to ${dialogMode} user`, severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Desktop DataGrid columns
  const columns = useMemo(() => [
    { field: 'id', headerName: 'ID', width: 90, hide: true },
    {
      field: 'avatar',
      headerName: '',
      width: 50,
      sortable: false,
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        return (
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
            {row.first_name?.[0] || row.username?.[0] || 'U'}
          </Avatar>
        );
      },
    },
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      sortable: true,
      valueGetter: (value, row) => {
        if (!row) return '';
        return [row.first_name, row.last_name].filter(Boolean).join(' ') || row.username || '';
      },
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ');
        return (
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {fullName || row.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              @{row.username}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 220,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailOutlined fontSize="small" color="action" />
          <Typography variant="body2">{params?.row?.email || ''}</Typography>
        </Box>
      ),
    },
    {
      field: 'roles',
      headerName: 'Roles',
      width: 250,
      renderCell: (params) => {
        const roles = params?.row?.roles || [];
        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {roles.map((roleCode) => {
              const roleDetails = getRoleDetails(roleCode);
              return (
                <Tooltip key={roleCode} title={roleDetails.description || roleDetails.name}>
                  <Chip
                    label={roleDetails.name}
                    size="small"
                    color={roleDetails.color}
                    variant="outlined"
                    icon={<AdminPanelSettingsOutlined />}
                  />
                </Tooltip>
              );
            })}
          </Stack>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        return (
          <Stack spacing={0.5}>
            <Chip
              label={row.is_active ? 'Active' : 'Inactive'}
              size="small"
              color={row.is_active ? 'success' : 'default'}
              icon={row.is_active ? <LockOpenOutlined /> : <LockOutlined />}
            />
            {row.is_verified && (
              <Chip
                label="Verified"
                size="small"
                color="info"
                variant="outlined"
                icon={<VerifiedUserOutlined />}
              />
            )}
          </Stack>
        );
      },
    },
    {
      field: 'last_login',
      headerName: 'Last Login',
      width: 180,
      valueGetter: (value, row) => {
        const lastLogin = row?.last_login;
        return lastLogin ? new Date(lastLogin).toLocaleString() : 'Never';
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        return (
          <Box>
            <Tooltip title="Edit User">
              <IconButton size="small" onClick={() => handleOpenEditDialog(row)}>
                <EditOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset Password">
              <IconButton size="small" onClick={() => handleOpenResetDialog(row)}>
                <LockOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            {row.id !== currentUser?.id && (
              <Tooltip title="Delete User">
                <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog(row)}>
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
  ], [currentUser, rolesList]);

  // Mobile-friendly user card component
  const UserCard = ({ user }) => {
    const isExpanded = expandedUser === user.id;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
    
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  user.is_active ? 
                    <Box sx={{ width: 10, height: 10, bgcolor: 'success.main', borderRadius: '50%' }} /> : 
                    <Box sx={{ width: 10, height: 10, bgcolor: 'error.main', borderRadius: '50%' }} />
                }
              >
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  {user.first_name?.[0] || user.username?.[0] || 'U'}
                </Avatar>
              </Badge>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {fullName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  @{user.username}
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => handleExpandUser(user.id)}>
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip
              label={user.is_active ? 'Active' : 'Inactive'}
              size="small"
              color={user.is_active ? 'success' : 'default'}
              icon={user.is_active ? <LockOpenOutlined /> : <LockOutlined />}
            />
            {user.is_verified && (
              <Chip
                label="Verified"
                size="small"
                color="info"
                variant="outlined"
                icon={<VerifiedUserOutlined />}
              />
            )}
          </Stack>
        </CardContent>
        
        <Collapse in={isExpanded}>
          <Divider />
          <CardContent>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailOutlined fontSize="small" color="action" />
                <Typography variant="body2">{user.email}</Typography>
              </Box>
              {user.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PhoneOutlined fontSize="small" color="action" />
                  <Typography variant="body2">{user.phone}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Roles:
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {(user.roles || []).map((roleCode) => {
                    const roleDetails = getRoleDetails(roleCode);
                    return (
                      <Chip
                        key={roleCode}
                        label={roleDetails.name}
                        size="small"
                        color={roleDetails.color}
                        variant="outlined"
                      />
                    );
                  })}
                </Stack>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last Login: {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
              </Typography>
            </Stack>
          </CardContent>
          <Divider />
          <CardActions>
            <Stack direction="row" spacing={1} sx={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                startIcon={<EditOutlined />}
                onClick={() => handleOpenEditDialog(user)}
              >
                Edit
              </Button>
              <Button
                size="small"
                startIcon={<LockOutlined />}
                onClick={() => handleOpenResetDialog(user)}
              >
                Reset PW
              </Button>
              {user.id !== currentUser?.id && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlined />}
                  onClick={() => handleOpenDeleteDialog(user)}
                >
                  Delete
                </Button>
              )}
            </Stack>
          </CardActions>
        </Collapse>
      </Card>
    );
  };

  // Stats
  const stats = useMemo(() => ({
    total: total || 0,
    active: users?.filter(u => u.is_active).length || 0,
    verified: users?.filter(u => u.is_verified).length || 0,
    admins: users?.filter(u => u.roles?.includes('admin')).length || 0,
  }), [users, total]);

  if (isLoading && (!users || users.length === 0)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
      {/* Header with Refresh Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 2, sm: 3, md: 4 } }}>
        <Box>
          <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700} gutterBottom>
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage system users, roles, and permissions
          </Typography>
        </Box>
        <Tooltip title="Refresh Data">
          <IconButton onClick={handleRefresh} color="primary">
            <RefreshOutlined />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={{ xs: 1, sm: 2, md: 3 }} sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Total Users
              </Typography>
              <Typography variant="h5" fontWeight={600}>{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Active
              </Typography>
              <Typography variant="h5" fontWeight={600} color="success.main">{stats.active}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Verified
              </Typography>
              <Typography variant="h5" fontWeight={600} color="info.main">{stats.verified}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Admins
              </Typography>
              <Typography variant="h5" fontWeight={600} color="warning.main">{stats.admins}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Actions */}
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 3 } }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid size={{ xs: 12, sm: 12, md: 4 }}>
            <TextField
              fullWidth
              placeholder="Search users..."
              value={searchTerm}
              onChange={handleSearch}
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                label="Role"
              >
                <MenuItem value="all">All Roles</MenuItem>
                {rolesList?.map((role) => (
                  <MenuItem key={role.id} value={role.code}>
                    {role.name || role.code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 12, md: 2 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<PersonAddOutlined />}
              onClick={handleOpenCreateDialog}
              size={isMobile ? "small" : "medium"}
            >
              Add User
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Users Table - Desktop */}
      {!isMobile && (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <Box sx={{ height: 600, width: '100%' }}>
            <DataGrid
              rows={users || []}
              columns={columns}
              loading={isLoading}
              rowCount={total || 0}
              paginationMode="server"
              pageSizeOptions={[10, 25, 50]}
              paginationModel={{ page, pageSize: rowsPerPage }}
              onPaginationModelChange={(model) => {
                handlePageChange(model.page);
                handleRowsPerPageChange(model.pageSize);
              }}
              disableRowSelectionOnClick
              getRowId={(row) => row.id}
              sx={{
                '& .MuiDataGrid-cell': {
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                },
              }}
            />
          </Box>
        </Paper>
      )}

      {/* Users Cards - Mobile */}
      {isMobile && (
        <Box>
          {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
          {!isLoading && users?.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No users found</Typography>
            </Paper>
          )}
          {!isLoading && users?.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
          {!isLoading && users?.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0}
                size="small"
              >
                Previous
              </Button>
              <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                Page {page + 1} of {Math.ceil(total / rowsPerPage)}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => handlePageChange(page + 1)}
                disabled={(page + 1) * rowsPerPage >= total}
                size="small"
              >
                Next
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => !isSubmitting && setDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {dialogMode === 'create' && 'Create New User'}
          {dialogMode === 'edit' && `Edit User: ${selectedUser?.username}`}
          {dialogMode === 'delete' && 'Confirm Delete'}
          {dialogMode === 'reset' && `Reset Password: ${selectedUser?.username}`}
        </DialogTitle>
        <DialogContent>
          {(dialogMode === 'create' || dialogMode === 'edit') && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                  required
                  disabled={isSubmitting}
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleFormChange}
                  error={!!formErrors.username}
                  helperText={formErrors.username}
                  required
                  disabled={isSubmitting}
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleFormChange}
                  disabled={isSubmitting}
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleFormChange}
                  disabled={isSubmitting}
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  disabled={isSubmitting}
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid size={12}>
                <FormControl fullWidth disabled={isSubmitting} size={isMobile ? "small" : "medium"}>
                  <InputLabel id="roles-multiple-chip-label">Roles</InputLabel>
                  <Select
                    labelId="roles-multiple-chip-label"
                    multiple
                    value={formData.roles || []}
                    onChange={handleRoleChange}
                    input={<OutlinedInput id="select-multiple-chip" label="Roles" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected || []).map((roleCode) => {
                          const roleDetails = getRoleDetails(roleCode);
                          return (
                            <Chip
                              key={roleCode}
                              label={roleDetails.name}
                              size="small"
                              color={roleDetails.color}
                            />
                          );
                        })}
                      </Box>
                    )}
                    MenuProps={MenuProps}
                  >
                    {rolesLoading ? (
                      <MenuItem disabled>
                        <CircularProgress size={20} sx={{ mr: 1 }} /> Loading roles...
                      </MenuItem>
                    ) : (
                      rolesList?.map((role) => (
                        <MenuItem key={role.id} value={role.code}>
                          <Checkbox checked={(formData.roles || []).indexOf(role.code) > -1} />
                          <ListItemText 
                            primary={role.name || role.code} 
                            secondary={role.description} 
                          />
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      disabled={isSubmitting}
                    />
                  }
                  label="Active"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_verified}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_verified: e.target.checked }))}
                      disabled={isSubmitting}
                    />
                  }
                  label="Email Verified"
                />
              </Grid>
              
              {dialogMode === 'create' && (
                <>
                  <Grid size={12}>
                    <TextField
                      fullWidth
                      label="Password"
                      name="password"
                      type="password"
                      value={passwordData.password}
                      onChange={handlePasswordChange}
                      error={!!formErrors.password}
                      helperText={formErrors.password}
                      required
                      disabled={isSubmitting}
                      size={isMobile ? "small" : "medium"}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      fullWidth
                      label="Confirm Password"
                      name="confirm_password"
                      type="password"
                      value={passwordData.confirm_password}
                      onChange={handlePasswordChange}
                      error={!!formErrors.confirm_password}
                      helperText={formErrors.confirm_password}
                      required
                      disabled={isSubmitting}
                      size={isMobile ? "small" : "medium"}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          )}

          {dialogMode === 'reset' && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="New Password"
                  name="password"
                  type="password"
                  value={passwordData.password}
                  onChange={handlePasswordChange}
                  error={!!formErrors.password}
                  helperText={formErrors.password}
                  required
                  disabled={isSubmitting}
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Confirm New Password"
                  name="confirm_password"
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  error={!!formErrors.confirm_password}
                  helperText={formErrors.confirm_password}
                  required
                  disabled={isSubmitting}
                  size={isMobile ? "small" : "medium"}
                />
              </Grid>
            </Grid>
          )}

          {dialogMode === 'delete' && (
            <Typography sx={{ mt: 2 }}>
              Are you sure you want to delete user <strong>{selectedUser?.username}</strong>? 
              This action cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color={dialogMode === 'delete' ? 'error' : 'primary'}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <CircularProgress size={24} />
            ) : (
              <>
                {dialogMode === 'create' && 'Create'}
                {dialogMode === 'edit' && 'Save Changes'}
                {dialogMode === 'delete' && 'Delete'}
                {dialogMode === 'reset' && 'Reset Password'}
              </>
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default UserManagement;