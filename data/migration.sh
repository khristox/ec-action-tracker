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