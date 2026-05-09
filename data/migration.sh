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
  alpha,
  DatePicker,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
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
  OpenInNewOutlined,
  LocationOnOutlined,
  WorkOutlineOutlined,
  SchoolOutlined,
  DescriptionOutlined,
  LanguageOutlined,
  AttachMoneyOutlined,
  CalendarTodayOutlined,
  PublicOutlined,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  updateUserRoles,
} from '../../store/slices/adminSlice';
import { fetchRoles, selectAllRoles, selectRolesLoading } from '../../store/slices/roleSlice';
import UserDetailPanel from './UserDetailPanel';
import api from '../../services/api';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: { maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP, width: 250 },
  },
};

// Attribute options
const fetchAttributeOptions = async (group) => {
  try {
    const res = await api.get(`/attribute-groups/${group}/attributes`, {
      params: { active_only: true, sort_by: 'sort_order', sort_order: 'asc', limit: 100 }
    });
    const items = res.data?.items || res.data || [];
    return items.map(item => ({
      id: item.id,
      label: item.name?.replace(`${group} - `, '') || item.short_name || item.name,
      value: item.short_name,
      sort_order: item.sort_order
    })).sort((a, b) => a.sort_order - b.sort_order);
  } catch (error) {
    console.error(`Failed to fetch ${group}:`, error);
    return [];
  }
};

const UserManagement = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

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
  const [detailUser, setDetailUser] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [expandedUser, setExpandedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Attribute options
  const [genderOptions, setGenderOptions] = useState([]);
  const [languageOptions, setLanguageOptions] = useState([]);
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [countryOptions, setCountryOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    first_name: '',
    last_name: '',
    phone: '',
    roles: [],
    is_active: true,
    is_verified: false,
    // New fields
    gender_attribute_id: '',
    language_attribute_id: '',
    currency_attribute_id: '',
    country_attribute_id: '',
    location_id: '',
    date_of_birth: null,
    address: '',
    city: '',
    state: '',
    postal_code: '',
    occupation: '',
    education: '',
    bio: '',
  });
  
  const [passwordData, setPasswordData] = useState({ password: '', confirm_password: '' });
  const [formErrors, setFormErrors] = useState({});

  // Fetch attribute options
  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      const [genders, languages, currencies, countries] = await Promise.all([
        fetchAttributeOptions('GENDER'),
        fetchAttributeOptions('LANGUAGE'),
        fetchAttributeOptions('CURRENCY'),
        fetchAttributeOptions('COUNTRY')
      ]);
      setGenderOptions(genders);
      setLanguageOptions(languages);
      setCurrencyOptions(currencies);
      setCountryOptions(countries);
      setLoadingOptions(false);
    };
    loadOptions();
  }, []);

  // Fetch roles
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
  const handleRowsPerPageChange = (newSize) => { setRowsPerPage(newSize); setPage(0); };
  const handleSearch = (e) => { setSearchTerm(e.target.value); setPage(0); };
  const handleRefresh = () => {
    loadUsers();
    dispatch(fetchRoles());
    setSnackbar({ open: true, message: 'Data refreshed', severity: 'success' });
  };

  const handleOpenDetailPanel = (user) => setDetailUser(user);
  const handleCloseDetailPanel = () => setDetailUser(null);
  const handleUserUpdated = () => {
    loadUsers();
    setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' });
  };

  // Dialog helpers
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
      gender_attribute_id: '',
      language_attribute_id: '',
      currency_attribute_id: '',
      country_attribute_id: '',
      location_id: '',
      date_of_birth: null,
      address: '',
      city: '',
      state: '',
      postal_code: '',
      occupation: '',
      education: '',
      bio: '',
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
      roles: [...(user.roles || [])],
      is_active: user.is_active,
      is_verified: user.is_verified,
      gender_attribute_id: user.gender_attribute_id || '',
      language_attribute_id: user.language_attribute_id || '',
      currency_attribute_id: user.currency_attribute_id || '',
      country_attribute_id: user.country_attribute_id || '',
      location_id: user.location_id || '',
      date_of_birth: user.date_of_birth ? new Date(user.date_of_birth) : null,
      address: user.address || '',
      city: user.city || '',
      state: user.state || '',
      postal_code: user.postal_code || '',
      occupation: user.occupation || '',
      education: user.education || '',
      bio: user.bio || '',
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
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, date_of_birth: date }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleRoleChange = (e) => setFormData(prev => ({ ...prev, roles: [...e.target.value] }));
  const handleExpandUser = (userId) => setExpandedUser(expandedUser === userId ? null : userId);

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
    else if (formData.username.length < 3) errors.username = 'At least 3 characters';
    if (!passwordData.password) errors.password = 'Password is required';
    else if (passwordData.password.length < 8) errors.password = 'Min 8 characters';
    if (passwordData.password !== passwordData.confirm_password) errors.confirm_password = 'Passwords do not match';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateEditForm = () => {
    const errors = {};
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Email is invalid';
    if (!formData.username) errors.username = 'Username is required';
    else if (formData.username.length < 3) errors.username = 'At least 3 characters';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateResetForm = () => {
    const errors = {};
    if (!passwordData.password) errors.password = 'Password is required';
    else if (passwordData.password.length < 8) errors.password = 'Min 8 characters';
    if (passwordData.password !== passwordData.confirm_password) errors.confirm_password = 'Passwords do not match';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (dialogMode === 'create') {
        if (!validateCreateForm()) { setIsSubmitting(false); return; }
        const submitData = {
          ...formData,
          password: passwordData.password,
          date_of_birth: formData.date_of_birth?.toISOString().split('T')[0] || null,
        };
        await dispatch(createUser(submitData)).unwrap();
        setSnackbar({ open: true, message: 'User created successfully', severity: 'success' });
        setDialogOpen(false);
        loadUsers();

      } else if (dialogMode === 'edit') {
        if (!validateEditForm()) { setIsSubmitting(false); return; }
        const submitData = {
          id: selectedUser.id,
          email: formData.email,
          username: formData.username,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          is_active: formData.is_active,
          is_verified: formData.is_verified,
          gender_attribute_id: formData.gender_attribute_id || null,
          language_attribute_id: formData.language_attribute_id || null,
          currency_attribute_id: formData.currency_attribute_id || null,
          country_attribute_id: formData.country_attribute_id || null,
          location_id: formData.location_id || null,
          date_of_birth: formData.date_of_birth?.toISOString().split('T')[0] || null,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code,
          occupation: formData.occupation,
          education: formData.education,
          bio: formData.bio,
        };
        await dispatch(updateUser(submitData)).unwrap();
        
        const currentRoles = [...(selectedUser.roles || [])].sort();
        const newRoles = [...(formData.roles || [])].sort();
        if (JSON.stringify(currentRoles) !== JSON.stringify(newRoles)) {
          await dispatch(updateUserRoles({ id: selectedUser.id, roles: [...newRoles] })).unwrap();
        }
        setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' });
        setDialogOpen(false);
        loadUsers();

      } else if (dialogMode === 'delete') {
        await dispatch(deleteUser(selectedUser.id)).unwrap();
        setSnackbar({ open: true, message: 'User deleted successfully', severity: 'success' });
        setDialogOpen(false);
        if (detailUser?.id === selectedUser.id) setDetailUser(null);
        loadUsers();

      } else if (dialogMode === 'reset') {
        if (!validateResetForm()) { setIsSubmitting(false); return; }
        await dispatch(resetUserPassword({ user_id: selectedUser.id, new_password: passwordData.password })).unwrap();
        setSnackbar({ open: true, message: 'Password reset successfully', severity: 'success' });
        setDialogOpen(false);
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message || `Failed to ${dialogMode} user`, severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // DataGrid columns
  const columns = useMemo(() => [
    {
      field: 'avatar', headerName: '', width: 50, sortable: false,
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        return (
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 13, fontWeight: 700 }}>
            {row.first_name?.[0] || row.username?.[0] || 'U'}
          </Avatar>
        );
      },
    },
    {
      field: 'name', headerName: 'Name', width: 190, sortable: true,
      valueGetter: (value, row) => [row?.first_name, row?.last_name].filter(Boolean).join(' ') || row?.username || '',
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ');
        return (
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
              {fullName || row.username}
            </Typography>
            <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
              @{row.username}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'email', headerName: 'Email', width: 210,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <EmailOutlined fontSize="small" sx={{ color: isDarkMode ? '#6B7280' : 'text.disabled' }} />
          <Typography variant="body2" sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
            {params?.row?.email || ''}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'roles', headerName: 'Roles', width: 240,
      renderCell: (params) => {
        const roles = params?.row?.roles || [];
        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {roles.map(roleCode => {
              const { name, color, description } = getRoleDetails(roleCode);
              return (
                <Tooltip key={roleCode} title={description || name}>
                  <Chip 
                    label={name} 
                    size="small" 
                    color={color} 
                    variant="outlined" 
                    icon={<AdminPanelSettingsOutlined />} 
                    sx={{ 
                      fontWeight: 600,
                      borderColor: isDarkMode ? alpha(theme.palette[color].main, 0.5) : undefined,
                    }} 
                  />
                </Tooltip>
              );
            })}
          </Stack>
        );
      },
    },
    {
      field: 'status', headerName: 'Status', width: 130,
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
      field: 'last_login', headerName: 'Last Login', width: 175,
      valueGetter: (value, row) => row?.last_login ? new Date(row.last_login).toLocaleString() : 'Never',
      renderCell: (params) => (
        <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'actions', headerName: 'Actions', width: 165, sortable: false,
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        return (
          <Box>
            <Tooltip title="View / Edit Details">
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleOpenDetailPanel(row)}
                sx={{
                  bgcolor: detailUser?.id === row.id ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                }}
              >
                <OpenInNewOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Quick Edit">
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
  ], [currentUser, rolesList, detailUser, isDarkMode, theme]);

  // Mobile user card
  const UserCard = ({ user }) => {
    const isExpanded = expandedUser === user.id;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
    const isSelected = detailUser?.id === user.id;

    return (
      <Card
        sx={{
          mb: 1.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: isSelected ? 'primary.main' : isDarkMode ? '#374151' : 'divider',
          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : isDarkMode ? '#1F2937' : 'background.paper',
          transition: 'all 0.2s',
        }}
      >
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <Box sx={{ width: 9, height: 9, bgcolor: user.is_active ? 'success.main' : 'error.main', borderRadius: '50%', border: '1.5px solid', borderColor: 'background.paper' }} />
                }
              >
                <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, fontWeight: 700 }}>
                  {user.first_name?.[0] || user.username?.[0] || 'U'}
                </Avatar>
              </Badge>
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                  {fullName}
                </Typography>
                <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                  @{user.username}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title="View Details">
                <IconButton size="small" color="primary" onClick={() => handleOpenDetailPanel(user)}>
                  <OpenInNewOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => handleExpandUser(user.id)}>
                {isExpanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          </Box>

          <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip label={user.is_active ? 'Active' : 'Inactive'} size="small" color={user.is_active ? 'success' : 'default'} />
            {user.is_verified && <Chip label="Verified" size="small" color="info" variant="outlined" />}
          </Stack>
        </CardContent>

        <Collapse in={isExpanded}>
          <Divider sx={{ borderColor: isDarkMode ? '#374151' : 'divider' }} />
          <CardContent>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailOutlined fontSize="small" sx={{ color: isDarkMode ? '#6B7280' : 'text.disabled' }} />
                <Typography variant="body2" sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>{user.email}</Typography>
              </Box>
              {user.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PhoneOutlined fontSize="small" sx={{ color: isDarkMode ? '#6B7280' : 'text.disabled' }} />
                  <Typography variant="body2" sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>{user.phone}</Typography>
                </Box>
              )}
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {(user.roles || []).map(roleCode => {
                  const { name, color } = getRoleDetails(roleCode);
                  return <Chip key={roleCode} label={name} size="small" color={color} variant="outlined" />;
                })}
              </Stack>
              <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                Last Login: {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
              </Typography>
            </Stack>
          </CardContent>
          <Divider sx={{ borderColor: isDarkMode ? '#374151' : 'divider' }} />
          <CardActions sx={{ px: 2, py: 1 }}>
            <Stack direction="row" spacing={1} sx={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button size="small" startIcon={<OpenInNewOutlined />} color="primary" onClick={() => handleOpenDetailPanel(user)}>
                Details
              </Button>
              <Button size="small" startIcon={<EditOutlined />} onClick={() => handleOpenEditDialog(user)}>
                Edit
              </Button>
              <Button size="small" startIcon={<LockOutlined />} onClick={() => handleOpenResetDialog(user)}>
                Reset PW
              </Button>
              {user.id !== currentUser?.id && (
                <Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={() => handleOpenDeleteDialog(user)}>
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.total, color: 'text.primary' },
    { label: 'Active', value: stats.active, color: 'success.main' },
    { label: 'Verified', value: stats.verified, color: 'info.main' },
    { label: 'Admins', value: stats.admins, color: 'warning.main' },
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={800} gutterBottom sx={{ letterSpacing: -0.5, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
              User Management
            </Typography>
            <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
              Manage system users, roles and permissions
            </Typography>
          </Box>
          <Tooltip title="Refresh">
            <IconButton
              onClick={handleRefresh}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
              }}
            >
              <RefreshOutlined />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Stats */}
        <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 3 }}>
          {statCards.map(({ label, value, color }) => (
            <Grid key={label} size={{ xs: 6, sm: 6, md: 3 }}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: isDarkMode ? '#374151' : 'divider',
                  bgcolor: isDarkMode ? '#1F2937' : 'background.paper',
                }}
              >
                <Typography variant="caption" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem', color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                  {label}
                </Typography>
                <Typography variant="h4" fontWeight={800} color={color} sx={{ mt: 0.5 }}>
                  {value}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Filters */}
        <Paper
          elevation={0}
          sx={{ 
            p: { xs: 1.5, sm: 2 }, 
            mb: 2, 
            borderRadius: 2, 
            border: '1px solid', 
            borderColor: isDarkMode ? '#374151' : 'divider', 
            bgcolor: isDarkMode ? '#1F2937' : 'background.paper' 
          }}
        >
          <Grid container spacing={1.5} alignItems="center">
            <Grid size={{ xs: 12, sm: 12, md: 4 }}>
              <TextField
                fullWidth
                placeholder="Search users…"
                value={searchTerm}
                onChange={handleSearch}
                size="small"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlined fontSize="small" sx={{ color: isDarkMode ? '#6B7280' : 'text.disabled' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined,
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: isDarkMode ? '#9CA3AF' : 'inherit' }}>Status</InputLabel>
                <Select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)} 
                  label="Status"
                  sx={{
                    bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: isDarkMode ? '#4B5563' : undefined },
                  }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: isDarkMode ? '#9CA3AF' : 'inherit' }}>Role</InputLabel>
                <Select 
                  value={roleFilter} 
                  onChange={(e) => setRoleFilter(e.target.value)} 
                  label="Role"
                  sx={{
                    bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: isDarkMode ? '#4B5563' : undefined },
                  }}
                >
                  <MenuItem value="all">All Roles</MenuItem>
                  {rolesList?.map(role => (
                    <MenuItem key={role.id} value={role.code}>{role.name || role.code}</MenuItem>
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
                sx={{ borderRadius: 1.5, fontWeight: 700 }}
              >
                Add User
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Main layout: Table + side panel */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>

          {/* Table / Cards */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Desktop DataGrid */}
            {!isMobile && (
              <Paper
                elevation={0}
                sx={{ 
                  borderRadius: 2, 
                  border: '1px solid', 
                  borderColor: isDarkMode ? '#374151' : 'divider', 
                  overflow: 'hidden', 
                  bgcolor: isDarkMode ? '#1F2937' : 'background.paper' 
                }}
              >
                <Box sx={{ height: 560, width: '100%' }}>
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
                    onRowClick={(params) => handleOpenDetailPanel(params.row)}
                    sx={{
                      border: 'none',
                      '& .MuiDataGrid-columnHeaders': {
                        bgcolor: isDarkMode
                          ? alpha(theme.palette.common.white, 0.04)
                          : alpha(theme.palette.common.black, 0.02),
                        borderBottom: '1px solid',
                        borderColor: isDarkMode ? '#374151' : 'divider',
                      },
                      '& .MuiDataGrid-columnHeaderTitle': { 
                        fontWeight: 700, 
                        fontSize: '0.75rem', 
                        letterSpacing: 0.5, 
                        color: isDarkMode ? '#9CA3AF' : 'text.secondary', 
                        textTransform: 'uppercase' 
                      },
                      '& .MuiDataGrid-row': {
                        cursor: 'pointer',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                        '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
                      },
                      '& .MuiDataGrid-cell': { 
                        borderColor: isDarkMode ? '#374151' : 'divider',
                        color: isDarkMode ? '#D1D5DB' : 'inherit',
                      },
                      '& .MuiDataGrid-footerContainer': { 
                        borderTop: '1px solid', 
                        borderColor: isDarkMode ? '#374151' : 'divider',
                        color: isDarkMode ? '#D1D5DB' : 'inherit',
                      },
                    }}
                  />
                </Box>
              </Paper>
            )}

            {/* Mobile cards */}
            {isMobile && (
              <Box>
                {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
                {!isLoading && users?.length === 0 && (
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 4, 
                      textAlign: 'center', 
                      borderRadius: 2, 
                      border: '1px solid', 
                      borderColor: isDarkMode ? '#374151' : 'divider',
                      bgcolor: isDarkMode ? '#1F2937' : 'background.paper',
                    }}
                  >
                    <Typography sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>No users found</Typography>
                  </Paper>
                )}
                {!isLoading && users?.map(user => <UserCard key={user.id} user={user} />)}
                {!isLoading && users?.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2, flexWrap: 'wrap' }}>
                    <Button variant="outlined" onClick={() => handlePageChange(page - 1)} disabled={page === 0} size="small">Previous</Button>
                    <Typography variant="body2" sx={{ alignSelf: 'center', color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                      Page {page + 1} of {Math.ceil(total / rowsPerPage)}
                    </Typography>
                    <Button variant="outlined" onClick={() => handlePageChange(page + 1)} disabled={(page + 1) * rowsPerPage >= total} size="small">Next</Button>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {/* Side panel: UserDetailPanel */}
          {detailUser && (
            <Box
              sx={{
                width: { xs: '100%', md: 380 },
                flexShrink: 0,
                height: isMobile ? 'auto' : 560,
                position: isMobile ? 'fixed' : 'sticky',
                top: isMobile ? 0 : 16,
                left: isMobile ? 0 : 'auto',
                right: isMobile ? 0 : 'auto',
                bottom: isMobile ? 0 : 'auto',
                zIndex: isMobile ? 1200 : 1,
              }}
            >
              {isMobile && (
                <Box
                  onClick={handleCloseDetailPanel}
                  sx={{ position: 'fixed', inset: 0, bgcolor: alpha(theme.palette.common.black, 0.5), zIndex: -1 }}
                />
              )}
              <UserDetailPanel
                user={detailUser}
                onClose={handleCloseDetailPanel}
                onUpdated={handleUserUpdated}
              />
            </Box>
          )}
        </Box>

        {/* Create / Edit / Delete / Reset Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => !isSubmitting && setDialogOpen(false)}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
          PaperProps={{
            sx: {
              borderRadius: isMobile ? 0 : 2,
              border: '1px solid',
              borderColor: isDarkMode ? '#374151' : 'divider',
              bgcolor: isDarkMode ? '#1F2937' : 'background.paper',
            },
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid', borderColor: isDarkMode ? '#374151' : 'divider', pb: 2, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
            {dialogMode === 'create' && 'Create New User'}
            {dialogMode === 'edit' && `Edit: ${selectedUser?.username}`}
            {dialogMode === 'delete' && 'Confirm Delete'}
            {dialogMode === 'reset' && `Reset Password: ${selectedUser?.username}`}
          </DialogTitle>

          <DialogContent sx={{ pt: 2 }}>
            {(dialogMode === 'create' || dialogMode === 'edit') && (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {/* Basic Information */}
                <Grid size={12}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
                    Basic Information
                  </Typography>
                </Grid>
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
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
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
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
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
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
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
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
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
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>

                {/* Personal Details */}
                <Grid size={12}>
                  <Divider sx={{ my: 1, borderColor: isDarkMode ? '#374151' : 'divider' }} />
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, mt: 1, color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
                    Personal Details
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label="Gender"
                    name="gender_attribute_id"
                    value={formData.gender_attribute_id}
                    onChange={handleFormChange}
                    disabled={isSubmitting || loadingOptions}
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {genderOptions.map(opt => (
                      <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label="Language"
                    name="language_attribute_id"
                    value={formData.language_attribute_id}
                    onChange={handleFormChange}
                    disabled={isSubmitting || loadingOptions}
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {languageOptions.map(opt => (
                      <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label="Currency"
                    name="currency_attribute_id"
                    value={formData.currency_attribute_id}
                    onChange={handleFormChange}
                    disabled={isSubmitting || loadingOptions}
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {currencyOptions.map(opt => (
                      <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label="Country"
                    name="country_attribute_id"
                    value={formData.country_attribute_id}
                    onChange={handleFormChange}
                    disabled={isSubmitting || loadingOptions}
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {countryOptions.map(opt => (
                      <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Location ID (CTE)"
                    name="location_id"
                    value={formData.location_id}
                    onChange={handleFormChange}
                    disabled={isSubmitting}
                    size="small"
                    helperText="Location ID from CTE system"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Date of Birth"
                    name="date_of_birth"
                    type="date"
                    value={formData.date_of_birth ? new Date(formData.date_of_birth).toISOString().split('T')[0] : ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value || null }))}
                    disabled={isSubmitting}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>

                {/* Address Information */}
                <Grid size={12}>
                  <Divider sx={{ my: 1, borderColor: isDarkMode ? '#374151' : 'divider' }} />
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, mt: 1, color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
                    Address Information
                  </Typography>
                </Grid>
                <Grid size={12}>
                  <TextField 
                    fullWidth 
                    label="Address" 
                    name="address" 
                    value={formData.address} 
                    onChange={handleFormChange} 
                    disabled={isSubmitting} 
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="City" 
                    name="city" 
                    value={formData.city} 
                    onChange={handleFormChange} 
                    disabled={isSubmitting} 
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="State/Province" 
                    name="state" 
                    value={formData.state} 
                    onChange={handleFormChange} 
                    disabled={isSubmitting} 
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Postal Code" 
                    name="postal_code" 
                    value={formData.postal_code} 
                    onChange={handleFormChange} 
                    disabled={isSubmitting} 
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>

                {/* Professional Information */}
                <Grid size={12}>
                  <Divider sx={{ my: 1, borderColor: isDarkMode ? '#374151' : 'divider' }} />
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, mt: 1, color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
                    Professional Information
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Occupation" 
                    name="occupation" 
                    value={formData.occupation} 
                    onChange={handleFormChange} 
                    disabled={isSubmitting} 
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField 
                    fullWidth 
                    label="Education" 
                    name="education" 
                    value={formData.education} 
                    onChange={handleFormChange} 
                    disabled={isSubmitting} 
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField 
                    fullWidth 
                    label="Bio" 
                    name="bio" 
                    multiline 
                    rows={3} 
                    value={formData.bio} 
                    onChange={handleFormChange} 
                    disabled={isSubmitting} 
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>

                {/* Roles & Status */}
                <Grid size={12}>
                  <Divider sx={{ my: 1, borderColor: isDarkMode ? '#374151' : 'divider' }} />
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, mt: 1, color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
                    Roles & Status
                  </Typography>
                </Grid>
                <Grid size={12}>
                  <FormControl fullWidth disabled={isSubmitting} size="small">
                    <InputLabel sx={{ color: isDarkMode ? '#9CA3AF' : 'inherit' }}>Roles</InputLabel>
                    <Select
                      multiple
                      value={formData.roles || []}
                      onChange={handleRoleChange}
                      input={<OutlinedInput label="Roles" />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected || []).map(roleCode => {
                            const { name, color } = getRoleDetails(roleCode);
                            return <Chip key={roleCode} label={name} size="small" color={color} />;
                          })}
                        </Box>
                      )}
                      MenuProps={MenuProps}
                      sx={{ bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined }}
                    >
                      {rolesLoading ? (
                        <MenuItem disabled><CircularProgress size={18} sx={{ mr: 1 }} /> Loading…</MenuItem>
                      ) : (
                        rolesList?.map(role => (
                          <MenuItem key={role.id} value={role.code}>
                            <Checkbox checked={(formData.roles || []).indexOf(role.code) > -1} size="small" />
                            <ListItemText 
                              primary={role.name || role.code} 
                              secondary={role.description} 
                              primaryTypographyProps={{ sx: { color: isDarkMode ? '#D1D5DB' : 'inherit' } }}
                              secondaryTypographyProps={{ sx: { color: isDarkMode ? '#9CA3AF' : 'text.secondary' } }}
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
                        color="success" 
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
                        color="info" 
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
                        size="small"
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
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
                        size="small"
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            )}

            {dialogMode === 'reset' && (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
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
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
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
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.05) : undefined } }}
                  />
                </Grid>
              </Grid>
            )}

            {dialogMode === 'delete' && (
              <Alert severity="error" sx={{ mt: 2, borderRadius: 1.5 }}>
                Are you sure you want to delete <strong>{selectedUser?.username}</strong>? This action cannot be undone.
              </Alert>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: isDarkMode ? '#374151' : 'divider' }}>
            <Button onClick={() => setDialogOpen(false)} disabled={isSubmitting} sx={{ borderRadius: 1.5 }}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              color={dialogMode === 'delete' ? 'error' : 'primary'}
              disabled={isSubmitting}
              sx={{ borderRadius: 1.5, minWidth: 120 }}
            >
              {isSubmitting ? (
                <CircularProgress size={20} />
              ) : (
                <>
                  {dialogMode === 'create' && 'Create User'}
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
          autoHideDuration={5000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            variant="filled"
            sx={{ borderRadius: 2 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
};

export default UserManagement;




-- Create meeting_recordings table
CREATE TABLE IF NOT EXISTS meeting_recordings (
    id CHAR(36) PRIMARY KEY,
    meeting_id CHAR(36) NOT NULL,
    
    -- Recording metadata
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    category VARCHAR(50) DEFAULT 'meeting',
    recording_type ENUM('video', 'audio') NOT NULL DEFAULT 'video',
    
    -- File information
    file_data LONGBLOB NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    duration INT DEFAULT 0,
    
    -- Recording settings
    quality VARCHAR(20) NULL,
    format VARCHAR(10) NULL,
    
    -- Status
    status ENUM('processing', 'completed', 'failed', 'deleted') DEFAULT 'completed',
    
    -- Thumbnail
    thumbnail_data LONGBLOB NULL,
    has_thumbnail BOOLEAN DEFAULT FALSE,
    
    -- Statistics
    view_count INT DEFAULT 0,
    download_count INT DEFAULT 0,
    
    -- Share settings
    is_public BOOLEAN DEFAULT FALSE,
    share_token VARCHAR(100) NULL UNIQUE,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by_id CHAR(36) NULL,
    updated_by_id CHAR(36) NULL,
    
    -- Soft delete
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_recording_meeting (meeting_id),
    INDEX idx_recording_type (recording_type),
    INDEX idx_recording_status (status),
    INDEX idx_recording_created (created_at),
    INDEX idx_recording_active (is_active),
    INDEX idx_recording_share_token (share_token),
    
    -- Foreign keys
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


ALTER TABLE `meeting_recordings` 
ADD COLUMN `original_filename` VARCHAR(500) NULL AFTER `file_name`;



-- Step 1: Change recording_type from ENUM to VARCHAR
ALTER TABLE meeting_recordings 
MODIFY COLUMN recording_type VARCHAR(20) DEFAULT 'VIDEO';

-- Step 2: Change status from ENUM to VARCHAR
ALTER TABLE meeting_recordings 
MODIFY COLUMN status VARCHAR(50) DEFAULT 'PROCESSING';

-- Step 3: Update all existing values to uppercase for both columns
UPDATE meeting_recordings SET recording_type = UPPER(recording_type) WHERE recording_type IS NOT NULL;
UPDATE meeting_recordings SET status = UPPER(status) WHERE status IS NOT NULL;

-- Step 4: Set default values for any NULLs
UPDATE meeting_recordings SET recording_type = 'VIDEO' WHERE recording_type IS NULL OR recording_type = '';
UPDATE meeting_recordings SET status = 'COMPLETED' WHERE status IS NULL OR status = '';

-- Step 5: Verify the data
SELECT DISTINCT recording_type FROM meeting_recordings;
SELECT DISTINCT status FROM meeting_recordings;




-- ==============================================
-- Complete Migration: Create Recurring Meetings Tables
-- Run this entire script to create both tables
-- ==============================================

-- Drop existing tables if they exist (optional, for clean install)
-- DROP TABLE IF EXISTS `recurring_meeting_occurrences`;
-- DROP TABLE IF EXISTS `recurring_meetings`;

-- Create recurring_meetings table
CREATE TABLE IF NOT EXISTS `recurring_meetings` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT,
    `recurrence_type_id` CHAR(36) NOT NULL,
    `recurrence_interval` INT DEFAULT 1,
    `recurrence_days` JSON,
    `recurrence_day_of_month` INT,
    `recurrence_week_of_month_id` CHAR(36),
    `recurrence_day_of_week_id` CHAR(36),
    `recurrence_end_date` DATETIME,
    `recurrence_max_occurrences` INT,
    `recurrence_end_after_occurrences` INT,
    `meeting_template_id` CHAR(36),
    `start_time` DATETIME NOT NULL,
    `end_time` DATETIME,
    `duration_minutes` INT,
    `location_id` CHAR(36),
    `location_text` VARCHAR(500),
    `platform` VARCHAR(50) DEFAULT 'physical',
    `meeting_link` VARCHAR(500),
    `chairperson_id` CHAR(36),
    `secretary_id` CHAR(36),
    `facilitator` VARCHAR(255),
    `default_participant_ids` JSON,
    `agenda` TEXT,
    `additional_info` JSON,
    `status_id` CHAR(36) NOT NULL,
    `last_occurrence_date` DATETIME,
    `next_occurrence_date` DATETIME,
    `occurrences_count` INT DEFAULT 0,
    `total_occurrences_generated` INT DEFAULT 0,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` BOOLEAN DEFAULT FALSE,
    `deleted_at` DATETIME,
    
    PRIMARY KEY (`id`),
    
    CONSTRAINT `fk_recurring_meetings_recurrence_type` 
        FOREIGN KEY (`recurrence_type_id`) REFERENCES `attributes`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_recurring_meetings_recurrence_week` 
        FOREIGN KEY (`recurrence_week_of_month_id`) REFERENCES `attributes`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_recurring_meetings_recurrence_day` 
        FOREIGN KEY (`recurrence_day_of_week_id`) REFERENCES `attributes`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_recurring_meetings_status` 
        FOREIGN KEY (`status_id`) REFERENCES `attributes`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_recurring_meetings_template` 
        FOREIGN KEY (`meeting_template_id`) REFERENCES `meetings`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_recurring_meetings_location` 
        FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_recurring_meetings_chairperson` 
        FOREIGN KEY (`chairperson_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_recurring_meetings_secretary` 
        FOREIGN KEY (`secretary_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_recurring_meetings_created_by` 
        FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`),
    
    INDEX `idx_recurring_meetings_status_next_date` (`status_id`, `next_occurrence_date`, `is_deleted`),
    INDEX `idx_recurring_meetings_created_by` (`created_by_id`, `is_deleted`),
    INDEX `idx_recurring_meetings_recurrence_type` (`recurrence_type_id`, `is_deleted`),
    INDEX `idx_recurring_meetings_status` (`status_id`, `is_deleted`),
    INDEX `idx_recurring_meetings_next_occurrence` (`next_occurrence_date`, `is_deleted`),
    INDEX `idx_recurring_meetings_created_at` (`created_at` DESC),
    INDEX `idx_recurring_meetings_title` (`title`(100), `is_deleted`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create recurring_meeting_occurrences table
CREATE TABLE IF NOT EXISTS `recurring_meeting_occurrences` (
    `id` CHAR(36) NOT NULL DEFAULT (UUID()),
    `recurring_meeting_id` CHAR(36) NOT NULL,
    `meeting_id` CHAR(36) NOT NULL,
    `occurrence_number` INT NOT NULL,
    `scheduled_date` DATETIME NOT NULL,
    `status` VARCHAR(20) DEFAULT 'scheduled',
    `rescheduled_to_date` DATETIME,
    `cancellation_reason` VARCHAR(500),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`id`),
    
    CONSTRAINT `fk_occurrences_recurring_meeting` 
        FOREIGN KEY (`recurring_meeting_id`) REFERENCES `recurring_meetings`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_occurrences_meeting` 
        FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON DELETE CASCADE,
    
    CONSTRAINT `uk_occurrence_number` 
        UNIQUE (`recurring_meeting_id`, `occurrence_number`),
    CONSTRAINT `uk_occurrence_meeting` 
        UNIQUE (`meeting_id`),
    
    INDEX `idx_occurrences_recurring_meeting` (`recurring_meeting_id`),
    INDEX `idx_occurrences_meeting` (`meeting_id`),
    INDEX `idx_occurrences_scheduled_date` (`scheduled_date`),
    INDEX `idx_occurrences_status` (`status`),
    INDEX `idx_occurrences_recurring_status_date` (`recurring_meeting_id`, `status`, `scheduled_date`),
    INDEX `idx_occurrences_date_range` (`scheduled_date`, `status`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Triggers for recurring_meetings table
DELIMITER $$

DROP TRIGGER IF EXISTS `validate_recurrence_interval_before_insert`$$
CREATE TRIGGER `validate_recurrence_interval_before_insert` 
BEFORE INSERT ON `recurring_meetings` 
FOR EACH ROW 
BEGIN
    IF NEW.recurrence_interval < 1 OR NEW.recurrence_interval > 365 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recurrence_interval must be between 1 and 365';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_recurrence_interval_before_update`$$
CREATE TRIGGER `validate_recurrence_interval_before_update` 
BEFORE UPDATE ON `recurring_meetings` 
FOR EACH ROW 
BEGIN
    IF NEW.recurrence_interval < 1 OR NEW.recurrence_interval > 365 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recurrence_interval must be between 1 and 365';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_recurrence_day_before_insert`$$
CREATE TRIGGER `validate_recurrence_day_before_insert` 
BEFORE INSERT ON `recurring_meetings` 
FOR EACH ROW 
BEGIN
    IF NEW.recurrence_day_of_month IS NOT NULL AND (NEW.recurrence_day_of_month < 1 OR NEW.recurrence_day_of_month > 31) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recurrence_day_of_month must be between 1 and 31';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_recurrence_day_before_update`$$
CREATE TRIGGER `validate_recurrence_day_before_update` 
BEFORE UPDATE ON `recurring_meetings` 
FOR EACH ROW 
BEGIN
    IF NEW.recurrence_day_of_month IS NOT NULL AND (NEW.recurrence_day_of_month < 1 OR NEW.recurrence_day_of_month > 31) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recurrence_day_of_month must be between 1 and 31';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_max_occurrences_before_insert`$$
CREATE TRIGGER `validate_max_occurrences_before_insert` 
BEFORE INSERT ON `recurring_meetings` 
FOR EACH ROW 
BEGIN
    IF NEW.recurrence_max_occurrences IS NOT NULL AND (NEW.recurrence_max_occurrences < 1 OR NEW.recurrence_max_occurrences > 999) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recurrence_max_occurrences must be between 1 and 999';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_max_occurrences_before_update`$$
CREATE TRIGGER `validate_max_occurrences_before_update` 
BEFORE UPDATE ON `recurring_meetings` 
FOR EACH ROW 
BEGIN
    IF NEW.recurrence_max_occurrences IS NOT NULL AND (NEW.recurrence_max_occurrences < 1 OR NEW.recurrence_max_occurrences > 999) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'recurrence_max_occurrences must be between 1 and 999';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_dates_before_insert`$$
CREATE TRIGGER `validate_dates_before_insert` 
BEFORE INSERT ON `recurring_meetings` 
FOR EACH ROW 
BEGIN
    IF NEW.end_time IS NOT NULL AND NEW.end_time <= NEW.start_time THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'end_time must be greater than start_time';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_dates_before_update`$$
CREATE TRIGGER `validate_dates_before_update` 
BEFORE UPDATE ON `recurring_meetings` 
FOR EACH ROW 
BEGIN
    IF NEW.end_time IS NOT NULL AND NEW.end_time <= NEW.start_time THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'end_time must be greater than start_time';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_duration_before_insert`$$
CREATE TRIGGER `validate_duration_before_insert` 
BEFORE INSERT ON `recurring_meetings` 
FOR EACH ROW 
BEGIN
    IF NEW.duration_minutes IS NOT NULL AND NEW.duration_minutes <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'duration_minutes must be greater than 0';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_duration_before_update`$$
CREATE TRIGGER `validate_duration_before_update` 
BEFORE UPDATE ON `recurring_meetings` 
FOR EACH ROW 
BEGIN
    IF NEW.duration_minutes IS NOT NULL AND NEW.duration_minutes <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'duration_minutes must be greater than 0';
    END IF;
END$$

-- Triggers for recurring_meeting_occurrences table
DROP TRIGGER IF EXISTS `validate_occurrence_status_before_insert`$$
CREATE TRIGGER `validate_occurrence_status_before_insert` 
BEFORE INSERT ON `recurring_meeting_occurrences` 
FOR EACH ROW 
BEGIN
    IF NEW.status NOT IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'skipped') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid status value';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_occurrence_status_before_update`$$
CREATE TRIGGER `validate_occurrence_status_before_update` 
BEFORE UPDATE ON `recurring_meeting_occurrences` 
FOR EACH ROW 
BEGIN
    IF NEW.status NOT IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'skipped') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid status value';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_reschedule_date_before_insert`$$
CREATE TRIGGER `validate_reschedule_date_before_insert` 
BEFORE INSERT ON `recurring_meeting_occurrences` 
FOR EACH ROW 
BEGIN
    IF NEW.rescheduled_to_date IS NOT NULL AND NEW.rescheduled_to_date <= NEW.scheduled_date THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rescheduled_to_date must be greater than scheduled_date';
    END IF;
END$$

DROP TRIGGER IF EXISTS `validate_reschedule_date_before_update`$$
CREATE TRIGGER `validate_reschedule_date_before_update` 
BEFORE UPDATE ON `recurring_meeting_occurrences` 
FOR EACH ROW 
BEGIN
    IF NEW.rescheduled_to_date IS NOT NULL AND NEW.rescheduled_to_date <= NEW.scheduled_date THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rescheduled_to_date must be greater than scheduled_date';
    END IF;
END$$

DELIMITER ;

-- Verification
SELECT 
    '✅ Tables created successfully!' AS Status,
    COUNT(*) AS TableCount
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
AND table_name IN ('recurring_meetings', 'recurring_meeting_occurrences');

-- Add duration_minutes column to meetings table
ALTER TABLE meetings 
ADD COLUMN duration_minutes INT NULL AFTER end_time;


-- Add platform and meeting_link columns if they dont exist
ALTER TABLE meetings 
ADD COLUMN platform VARCHAR(50) DEFAULT 'physical' NULL,
ADD COLUMN meeting_link VARCHAR(500) NULL;


-- ==============================================
-- Migration: Add recurring meeting columns to meetings table
-- ==============================================

-- Add is_recurring flag
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE NOT NULL 
COMMENT 'Whether this meeting is part of a recurring series';

-- Add recurring_meeting_id foreign key
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS recurring_meeting_id CHAR(36) NULL 
COMMENT 'Reference to recurring meeting if part of a series';

-- Add occurrence_number
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS occurrence_number INT NULL 
COMMENT 'Occurrence number in recurring series';

-- Add duration_minutes (if still missing)
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS duration_minutes INT NULL 
COMMENT 'Meeting duration in minutes';

-- Add platform (if still missing)
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'physical' NULL 
COMMENT 'Meeting platform (zoom, google_meet, teams, physical)';

-- Add meeting_link (if still missing)
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS meeting_link VARCHAR(500) NULL 
COMMENT 'URL for online meetings';

-- Add foreign key constraint for recurring_meeting_id
ALTER TABLE meetings 
ADD CONSTRAINT fk_meetings_recurring_meeting 
FOREIGN KEY (recurring_meeting_id) 
REFERENCES recurring_meetings(id) 
ON DELETE SET NULL;

-- Add indexes for better performance
CREATE INDEX idx_meetings_is_recurring ON meetings(is_recurring);
CREATE INDEX idx_meetings_recurring_meeting_id ON meetings(recurring_meeting_id);
CREATE INDEX idx_meetings_occurrence_number ON meetings(occurrence_number);

-- Verify all columns exist
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'meetings' 
AND COLUMN_NAME IN (
    'duration_minutes', 
    'platform', 
    'meeting_link',
    'is_recurring',
    'recurring_meeting_id',
    'occurrence_number'
)
ORDER BY ORDINAL_POSITION;


-- Add is_deleted column to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL 
COMMENT 'Soft delete flag for meetings';

-- Add an index for soft delete queries
CREATE INDEX idx_meetings_is_deleted ON meetings(is_deleted);

-- If you need to track when a meeting was deleted, add deleted_at as well
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL 
COMMENT 'Timestamp when meeting was soft deleted';





-- migrations/001_create_organization_tables_mysql.sql

-- Create organization_nodes table
-- migrations/001_create_organization_tables_mysql.sql

-- Create organization_nodes table with UUID
CREATE TABLE IF NOT EXISTS organization_nodes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(200) NOT NULL,
    title VARCHAR(200) NOT NULL,
    parent_id CHAR(36) NULL,
    level INT DEFAULT 0,
    path VARCHAR(1000) DEFAULT '',
    `order` INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Metadata fields
    email VARCHAR(200),
    phone VARCHAR(50),
    department_code VARCHAR(50),
    location VARCHAR(200),
    employee_count INT DEFAULT 0,
    budget DECIMAL(15,2) DEFAULT 0.00,
    color VARCHAR(20) DEFAULT '#4A90E2',
    additional_metadata JSON DEFAULT (JSON_OBJECT()),
    
    FOREIGN KEY (parent_id) REFERENCES organization_nodes(id) ON DELETE CASCADE,
    
    INDEX idx_org_parent_id (parent_id),
    INDEX idx_org_path (path(191)),
    INDEX idx_org_level (level),
    INDEX idx_org_is_active (is_active),
    INDEX idx_org_name (name(191)),
    INDEX idx_org_department_code (department_code),
    INDEX idx_org_order (`order`),
    INDEX idx_org_parent_active (parent_id, is_active),
    INDEX idx_org_level_order (level, `order`),
    INDEX idx_org_path_active (path(191), is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create trigger to generate UUID if not provided
DELIMITER $$

CREATE TRIGGER before_insert_organization_nodes
BEFORE INSERT ON organization_nodes
FOR EACH ROW
BEGIN
    -- Generate UUID if not provided
    IF NEW.id IS NULL OR NEW.id = '' THEN
        SET NEW.id = UUID();
    END IF;
    
    -- Update path and level based on parent
    DECLARE parent_path VARCHAR(1000);
    DECLARE parent_level INT;
    
    IF NEW.parent_id IS NULL OR NEW.parent_id = '' THEN
        SET NEW.level = 0;
        SET NEW.path = CONCAT('/', NEW.id);
    ELSE
        SELECT path, level INTO parent_path, parent_level
        FROM organization_nodes
        WHERE id = NEW.parent_id;
        
        SET NEW.level = parent_level + 1;
        SET NEW.path = CONCAT(parent_path, '/', NEW.id);
    END IF;
END$$

DELIMITER ;

-- Create trigger to update children paths when parent is updated
DELIMITER $$

CREATE TRIGGER after_update_organization_nodes
AFTER UPDATE ON organization_nodes
FOR EACH ROW
BEGIN
    -- If path changed, update all children
    IF OLD.path != NEW.path THEN
        UPDATE organization_nodes
        SET path = REPLACE(path, OLD.path, NEW.path),
            level = level + (NEW.level - OLD.level)
        WHERE path LIKE CONCAT(OLD.path, '%')
            AND id != NEW.id;
    END IF;
END$$

DELIMITER ;

-- Create stored procedure to get node descendants
DELIMITER $$

CREATE PROCEDURE GetNodeDescendants(IN node_id CHAR(36))
BEGIN
    SELECT 
        id, 
        name, 
        title,
        level, 
        path,
        parent_id,
        is_active,
        email,
        phone,
        department_code,
        location,
        employee_count,
        budget,
        color,
        created_at,
        updated_at
    FROM organization_nodes
    WHERE path LIKE CONCAT((SELECT path FROM organization_nodes WHERE id = node_id), '%')
        AND id != node_id
        AND is_active = TRUE
    ORDER BY level, `order`;
END$$

DELIMITER ;

-- Create stored procedure to get node ancestors
DELIMITER $$

CREATE PROCEDURE GetNodeAncestors(IN node_id CHAR(36))
BEGIN
    WITH RECURSIVE ancestors AS (
        SELECT 
            id, 
            name, 
            title,
            level, 
            path, 
            parent_id,
            is_active,
            email,
            phone,
            department_code,
            location,
            employee_count,
            budget,
            color
        FROM organization_nodes
        WHERE id = node_id
        UNION ALL
        SELECT 
            p.id, 
            p.name, 
            p.title,
            p.level, 
            p.path, 
            p.parent_id,
            p.is_active,
            p.email,
            p.phone,
            p.department_code,
            p.location,
            p.employee_count,
            p.budget,
            p.color
        FROM organization_nodes p
        INNER JOIN ancestors a ON p.id = a.parent_id
    )
    SELECT id, name, title, level, path
    FROM ancestors
    WHERE id != node_id
    ORDER BY level;
END$$

DELIMITER ;

-- Create stored procedure to get root nodes
DELIMITER $$

CREATE PROCEDURE GetRootNodes()
BEGIN
    SELECT 
        id, 
        name, 
        title,
        level, 
        path,
        `order`,
        is_active,
        email,
        phone,
        department_code,
        location,
        employee_count,
        budget,
        color,
        additional_metadata,
        created_at,
        updated_at
    FROM organization_nodes
    WHERE parent_id IS NULL AND is_active = TRUE
    ORDER BY `order`, name;
END$$

DELIMITER ;

-- Create stored procedure to get node subtree
DELIMITER $$

CREATE PROCEDURE GetNodeSubtree(IN node_id CHAR(36), IN max_depth INT)
BEGIN
    DECLARE start_path VARCHAR(1000);
    DECLARE start_level INT;
    
    SELECT path, level INTO start_path, start_level
    FROM organization_nodes
    WHERE id = node_id;
    
    SELECT 
        id, 
        name, 
        title,
        level, 
        path,
        parent_id,
        `order`,
        is_active,
        email,
        phone,
        department_code,
        location,
        employee_count,
        budget,
        color,
        additional_metadata,
        created_at,
        updated_at,
        (level - start_level) as depth
    FROM organization_nodes
    WHERE path LIKE CONCAT(start_path, '%')
        AND is_active = TRUE
        AND (max_depth IS NULL OR (level - start_level) <= max_depth)
    ORDER BY path, `order`;
END$$

DELIMITER ;

-- Create stored procedure to move node
DELIMITER $$

CREATE PROCEDURE MoveNode(
    IN node_id CHAR(36), 
    IN new_parent_id CHAR(36),
    IN new_order INT
)
BEGIN
    DECLARE old_path VARCHAR(1000);
    DECLARE new_path VARCHAR(1000);
    DECLARE new_level INT;
    
    -- Get current node data
    SELECT path INTO old_path
    FROM organization_nodes
    WHERE id = node_id;
    
    -- Calculate new path and level
    IF new_parent_id IS NULL OR new_parent_id = '' THEN
        SET new_level = 0;
        SET new_path = CONCAT('/', node_id);
    ELSE
        SELECT CONCAT(path, '/', node_id), level + 1 
        INTO new_path, new_level
        FROM organization_nodes
        WHERE id = new_parent_id;
    END IF;
    
    -- Update node
    UPDATE organization_nodes
    SET parent_id = new_parent_id,
        level = new_level,
        path = new_path,
        `order` = COALESCE(new_order, `order`)
    WHERE id = node_id;
    
    -- Update all descendants
    UPDATE organization_nodes
    SET path = REPLACE(path, old_path, new_path),
        level = level + (new_level - (SELECT level FROM organization_nodes WHERE id = node_id) + 1)
    WHERE path LIKE CONCAT(old_path, '%')
        AND id != node_id;
END$$

DELIMITER ;

-- Create view for flattened organization structure
CREATE OR REPLACE VIEW organization_structure AS
WITH RECURSIVE org_tree AS (
    SELECT 
        id,
        name,
        title,
        parent_id,
        level,
        path,
        `order`,
        is_active,
        email,
        phone,
        department_code,
        location,
        employee_count,
        budget,
        color,
        CAST(id AS CHAR(1000)) as breadcrumb_ids,
        CAST(name AS CHAR(1000)) as breadcrumb_names,
        CAST(CONCAT(name, ' (Level ', level, ')') AS CHAR(1000)) as breadcrumb_titles
    FROM organization_nodes
    WHERE parent_id IS NULL AND is_active = TRUE
    
    UNION ALL
    
    SELECT 
        c.id,
        c.name,
        c.title,
        c.parent_id,
        c.level,
        c.path,
        c.`order`,
        c.is_active,
        c.email,
        c.phone,
        c.department_code,
        c.location,
        c.employee_count,
        c.budget,
        c.color,
        CONCAT(p.breadcrumb_ids, '/', c.id),
        CONCAT(p.breadcrumb_names, ' > ', c.name),
        CONCAT(p.breadcrumb_titles, ' > ', c.name, ' (Level ', c.level, ')')
    FROM organization_nodes c
    INNER JOIN org_tree p ON c.parent_id = p.id
    WHERE c.is_active = TRUE
)
SELECT * FROM org_tree
ORDER BY breadcrumb_ids;

-- Create function to generate UUID v4 (if using MySQL 8.0)
DELIMITER $$

CREATE FUNCTION UUID_V4()
RETURNS CHAR(36)
DETERMINISTIC
BEGIN
    RETURN LOWER(CONCAT(
        LEFT(UUID(), 8),
        '-',
        SUBSTR(UUID(), 10, 4),
        '-4',
        SUBSTR(UUID(), 15, 3),
        '-',
        SUBSTR(UUID(), 19, 4),
        '-',
        SUBSTR(UUID(), 25)
    ));
END$$

DELIMITER ;

-- Create event to cleanup old soft-deleted nodes (optional)
-- Enable event scheduler first: SET GLOBAL event_scheduler = ON;
DELIMITER $$

CREATE EVENT IF NOT EXISTS cleanup_inactive_organization_nodes
ON SCHEDULE EVERY 1 WEEK
DO
BEGIN
    DELETE FROM organization_nodes
    WHERE is_active = FALSE 
        AND updated_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
END$$

DELIMITER ;

-- Insert sample root nodes
INSERT INTO organization_nodes (id, name, title, parent_id, `order`, email, department_code, location) VALUES
    (UUID_V4(), 'Corporate', 'CEO Office', NULL, 0, 'ceo@company.com', 'CORP', 'Headquarters'),
    (UUID_V4(), 'North America', 'Regional Director', NULL, 1, 'na@company.com', 'NA', 'New York Office'),
    (UUID_V4(), 'Europe', 'Regional Director', NULL, 2, 'eu@company.com', 'EU', 'London Office'),
    (UUID_V4(), 'Asia Pacific', 'Regional Director', NULL, 3, 'apac@company.com', 'APAC', 'Singapore Office');

-- Insert sample child nodes (get actual IDs from previous insert for parent_id references)
-- Note: Replace actual UUIDs with the ones generated above
-- INSERT INTO organization_nodes (name, title, parent_id, department_code, employee_count, budget) VALUES
--     ('Engineering', 'VP of Engineering', (SELECT id FROM organization_nodes WHERE department_code = 'CORP'), 'ENG', 150, 5000000.00),
--     ('Sales', 'VP of Sales', (SELECT id FROM organization_nodes WHERE department_code = 'CORP'), 'SALES', 75, 3000000.00),
--     ('Marketing', 'VP of Marketing', (SELECT id FROM organization_nodes WHERE department_code = 'CORP'), 'MKTG', 50, 2000000.00);

-- Create indexes for performance optimization
CREATE INDEX idx_org_path_search ON organization_nodes(path(255)) WHERE is_active = TRUE;
CREATE INDEX idx_org_updated_at ON organization_nodes(updated_at);
CREATE INDEX idx_org_created_at ON organization_nodes(created_at);
CREATE INDEX idx_org_budget ON organization_nodes(budget) WHERE budget > 0;
CREATE INDEX idx_org_employee_count ON organization_nodes(employee_count) WHERE employee_count > 0;
CREATE INDEX idx_org_parent_order ON organization_nodes(parent_id, `order`);

-- Create fulltext indexes for search
CREATE FULLTEXT INDEX idx_org_search ON organization_nodes(name, title, email, department_code, location);



-- migrations/002_create_user_departments_table_mysql.sql
-- migrations/002_create_user_departments_table_mysql.sql
-- Corrected version for MariaDB/MySQL

CREATE TABLE IF NOT EXISTS user_departments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    department_id VARCHAR(36) NOT NULL,
    role ENUM('head', 'manager', 'supervisor', 'member', 'temporary', 'contractor') DEFAULT 'member',
    status ENUM('active', 'inactive', 'pending', 'transferring') DEFAULT 'active',
    is_primary BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NULL,
    title VARCHAR(200) NULL,
    responsibilities JSON DEFAULT (JSON_ARRAY()),
    notes VARCHAR(500) NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES organization_nodes(id) ON DELETE CASCADE,
    
    -- Indexes (removed WHERE clauses)
    INDEX idx_ud_user_id (user_id),
    INDEX idx_ud_department_id (department_id),
    INDEX idx_ud_status (status),
    INDEX idx_ud_role (role),
    INDEX idx_ud_user_dept (user_id, department_id),
    INDEX idx_ud_primary (user_id, is_primary),
    INDEX idx_ud_active (status, start_date)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create a trigger to ensure only one primary department per user
DELIMITER $$

CREATE TRIGGER ensure_single_primary_before_insert
BEFORE INSERT ON user_departments
FOR EACH ROW
BEGIN
    IF NEW.is_primary = TRUE THEN
        UPDATE user_departments 
        SET is_primary = FALSE 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
END$$

CREATE TRIGGER ensure_single_primary_before_update
BEFORE UPDATE ON user_departments
FOR EACH ROW
BEGIN
    IF NEW.is_primary = TRUE AND OLD.is_primary != NEW.is_primary THEN
        UPDATE user_departments 
        SET is_primary = FALSE 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
END$$

DELIMITER ;

-- Create a view for active assignments
CREATE OR REPLACE VIEW active_user_departments AS
SELECT 
    ud.*,
    u.name as user_name,
    u.email as user_email,
    on.name as department_name,
    on.department_code,
    on.path as department_path
FROM user_departments ud
LEFT JOIN users u ON ud.user_id = u.id
LEFT JOIN organization_nodes on ON ud.department_id = on.id
WHERE ud.status = 'active' 
    AND (ud.end_date IS NULL OR ud.end_date > NOW());

-- Create a view for department hierarchy with user counts
-- Corrected view for department user counts
CREATE OR REPLACE VIEW department_user_counts AS
WITH RECURSIVE dept_tree AS (
    SELECT 
        id,
        name,
        parent_id,
        0 as level
    FROM organization_nodes
    WHERE parent_id IS NULL
    UNION ALL
    SELECT 
        org.id,
        org.name,
        org.parent_id,
        dt.level + 1
    FROM organization_nodes org
    INNER JOIN dept_tree dt ON org.parent_id = dt.id
)
SELECT 
    dt.id,
    dt.name,
    dt.parent_id,
    dt.level,
    COUNT(DISTINCT ud.user_id) as total_users,
    COUNT(DISTINCT CASE WHEN ud.role = 'head' THEN ud.user_id END) as heads,
    COUNT(DISTINCT CASE WHEN ud.role = 'manager' THEN ud.user_id END) as managers,
    COUNT(DISTINCT CASE WHEN ud.role = 'member' THEN ud.user_id END) as members
FROM dept_tree dt
LEFT JOIN user_departments ud ON dt.id = ud.department_id AND ud.status = 'active'
GROUP BY dt.id, dt.name, dt.parent_id, dt.level
ORDER BY dt.level, dt.name;


-- Drop existing table
DROP TABLE IF EXISTS user_departments;

-- Recreate with lowercase enums (matching Python model)
CREATE TABLE IF NOT EXISTS user_departments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    department_id VARCHAR(36) NOT NULL,
    role ENUM('head', 'manager', 'supervisor', 'member', 'temporary', 'contractor') DEFAULT 'member',
    status ENUM('active', 'inactive', 'pending', 'transferring') DEFAULT 'active',
    is_primary BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NULL,
    title VARCHAR(200) NULL,
    responsibilities JSON DEFAULT (JSON_ARRAY()),
    notes VARCHAR(500) NULL,
    created_by VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES organization_nodes(id) ON DELETE CASCADE,
    
    INDEX idx_ud_user_id (user_id),
    INDEX idx_ud_department_id (department_id),
    INDEX idx_ud_status (status),
    INDEX idx_ud_role (role),
    INDEX idx_ud_user_dept (user_id, department_id),
    INDEX idx_ud_primary (user_id, is_primary),
    INDEX idx_ud_active (status, start_date)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Connect to your database and run this
ALTER TABLE user_departments 
MODIFY COLUMN role VARCHAR(50) DEFAULT 'member',
MODIFY COLUMN status VARCHAR(50) DEFAULT 'active';

-- Update existing records to ensure they have values
UPDATE user_departments SET role = 'member' WHERE role IS NULL OR role = '';
UPDATE user_departments SET status = 'active' WHERE status IS NULL OR status = '';




-- Create staging table
CREATE TABLE org_nodes_updates (
    node_id CHAR(36) PRIMARY KEY,
    new_parent_id CHAR(36),
    new_level INT,
    new_path VARCHAR(500),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- After update trigger that inserts into staging
DELIMITER $$

CREATE TRIGGER org_nodes_after_update
AFTER UPDATE ON organization_nodes
FOR EACH ROW
BEGIN
    IF OLD.parent_id != NEW.parent_id OR OLD.path != NEW.path THEN
        INSERT INTO org_nodes_updates (node_id, new_parent_id, new_level, new_path)
        VALUES (NEW.id, NEW.parent_id, NEW.level, NEW.path)
        ON DUPLICATE KEY UPDATE
            new_parent_id = VALUES(new_parent_id),
            new_level = VALUES(new_level),
            new_path = VALUES(new_path),
            processed = FALSE;
    END IF;
END$$

-- Stored procedure to process updates safely
CREATE PROCEDURE process_org_updates()
BEGIN
    DECLARE v_node_id CHAR(36);
    DECLARE v_new_path VARCHAR(500);
    DECLARE done INT DEFAULT FALSE;
    DECLARE cur CURSOR FOR 
        SELECT node_id, new_path FROM org_nodes_updates WHERE processed = FALSE;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO v_node_id, v_new_path;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Update children (this won't trigger the cursor again)
        UPDATE organization_nodes 
        SET path = CONCAT(v_new_path, SUBSTRING_INDEX(path, '/', -1))
        WHERE parent_id = v_node_id;
        
        UPDATE org_nodes_updates SET processed = TRUE WHERE node_id = v_node_id;
    END LOOP;
    
    CLOSE cur;
END$$

DELIMITER ;

-- Create an event to process updates every 5 seconds
CREATE EVENT process_org_updates_event
ON SCHEDULE EVERY 5 SECOND
DO
CALL process_org_updates();



-- Drop ALL triggers that update the same table
DROP TRIGGER IF EXISTS update_organization_nodes_path;
DROP TRIGGER IF EXISTS after_update_organization_nodes;
DROP TRIGGER IF EXISTS organization_nodes_after_update;

-- If you want to keep the staging table approach, keep org_nodes_after_update
-- Otherwise, drop it too:
DROP TRIGGER IF EXISTS org_nodes_after_update;

-- Keep only the safe timestamp trigger
-- organization_nodes_before_update is safe (only sets NEW.updated_at)