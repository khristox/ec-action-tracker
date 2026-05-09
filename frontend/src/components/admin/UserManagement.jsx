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
  Collapse,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Badge,
  alpha,
  Autocomplete,
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
  OpenInNewOutlined,
  ShieldOutlined,
  PeopleAltOutlined,
  FilterListOutlined,
  CloseOutlined,
  BusinessOutlined,
  LinkOutlined,
  LinkOffOutlined,
  ApartmentOutlined,
  AccountTreeOutlined,
  SupervisorAccountOutlined,
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
import api from '../../services/api';
import UserDetailPanel from './UserDetailPanel';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: { maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP, width: 250 },
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
  const [superAdminFilter, setSuperAdminFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [expandedUser, setExpandedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Department linking dialog state
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [departmentUser, setDepartmentUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  
  // Store department assignments for each user
  const [userDepartmentsMap, setUserDepartmentsMap] = useState({});
  const [loadingUserDepts, setLoadingUserDepts] = useState({});

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    first_name: '',
    last_name: '',
    phone: '',
    roles: [],
    is_active: true,
    is_verified: false,
    is_superuser: false,
    department_ids: [],
  });
  const [passwordData, setPasswordData] = useState({ password: '', confirm_password: '' });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    dispatch(fetchRoles());
    fetchDepartments();
  }, [dispatch]);

  // Fetch departments from API
  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      setDepartments([]);
    }
  };

  // Fetch user department assignments
  const fetchUserDepartments = async (userId) => {
    // Don't fetch if already loading or already have data
    if (userDepartmentsMap[userId] || loadingUserDepts[userId]) {
      return userDepartmentsMap[userId];
    }
    
    setLoadingUserDepts(prev => ({ ...prev, [userId]: true }));
    try {
      const response = await api.get(`/users/${userId}/departments`);
      const assignments = response.data || [];
      setUserDepartmentsMap(prev => ({ ...prev, [userId]: assignments }));
      return assignments;
    } catch (error) {
      console.error('Failed to fetch user departments:', error);
      return [];
    } finally {
      setLoadingUserDepts(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Load departments for all users on the current page
  useEffect(() => {
    if (users && users.length > 0) {
      users.forEach(user => {
        // Only fetch if not already loaded
        if (!userDepartmentsMap[user.id] && !loadingUserDepts[user.id]) {
          fetchUserDepartments(user.id);
        }
      });
    }
  }, [users]);

  const loadUsers = useCallback(() => {
    dispatch(fetchUsers({
      page: page + 1,
      limit: rowsPerPage,
      search: searchTerm,
      is_active: statusFilter !== 'all' ? statusFilter === 'active' : undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      is_superuser: superAdminFilter !== 'all' ? superAdminFilter === 'yes' : undefined,
      department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
    }));
  }, [dispatch, page, rowsPerPage, searchTerm, statusFilter, roleFilter, superAdminFilter, departmentFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handlePageChange = (newPage) => setPage(newPage);
  const handleRowsPerPageChange = (newSize) => { setRowsPerPage(newSize); setPage(0); };
  const handleSearch = (e) => { setSearchTerm(e.target.value); setPage(0); };

  const handleRefresh = () => {
    // Clear cached departments to force refresh
    setUserDepartmentsMap({});
    setLoadingUserDepts({});
    loadUsers();
    dispatch(fetchRoles());
    fetchDepartments();
    setSnackbar({ open: true, message: 'Data refreshed', severity: 'success' });
  };

  const handleOpenDetailPanel = async (user) => {
    setDetailUser(user);
    await fetchUserDepartments(user.id);
  };
  const handleCloseDetailPanel = () => setDetailUser(null);
  const handleUserUpdated = () => {
    // Clear cache and reload
    setUserDepartmentsMap({});
    loadUsers();
    setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' });
  };

  // Department linking handlers
  const handleOpenDepartmentDialog = async (user) => {
    setDepartmentUser(user);
    const assignments = await fetchUserDepartments(user.id);
    const currentDeptIds = assignments.map(a => a.department_id);
    setSelectedDepartments(currentDeptIds);
    setDepartmentDialogOpen(true);
  };

  const handleLinkDepartments = async () => {
    if (!departmentUser) return;
    setIsSubmitting(true);
    try {
      await api.post(`/users/${departmentUser.id}/departments`, {
        department_ids: selectedDepartments,
      });
      // Clear cache for this user
      setUserDepartmentsMap(prev => ({ ...prev, [departmentUser.id]: null }));
      await fetchUserDepartments(departmentUser.id);
      
      setSnackbar({
        open: true,
        message: `Successfully linked to ${selectedDepartments.length} department(s)`,
        severity: 'success',
      });
      setDepartmentDialogOpen(false);
      loadUsers();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to link departments',
        severity: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlinkDepartment = async (userId, departmentId) => {
    try {
      await api.delete(`/users/${userId}/departments/${departmentId}`);
      // Clear cache for this user
      setUserDepartmentsMap(prev => ({ ...prev, [userId]: null }));
      await fetchUserDepartments(userId);
      
      setSnackbar({ open: true, message: 'Department unlinked successfully', severity: 'success' });
      loadUsers();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to unlink department', severity: 'error' });
    }
  };

  const getDepartmentRoleChip = (role) => {
    const roleConfig = {
      head: { color: 'error', icon: <SupervisorAccountOutlined sx={{ fontSize: 14 }} />, label: 'Head' },
      manager: { color: 'warning', icon: <SupervisorAccountOutlined sx={{ fontSize: 14 }} />, label: 'Manager' },
      supervisor: { color: 'info', icon: <AccountTreeOutlined sx={{ fontSize: 14 }} />, label: 'Supervisor' },
      member: { color: 'default', icon: null, label: 'Member' },
      temporary: { color: 'warning', icon: null, label: 'Temp' },
      contractor: { color: 'default', icon: null, label: 'Contractor' },
    };
    return roleConfig[role] || roleConfig.member;
  };

  const handleOpenCreateDialog = () => {
    setDialogMode('create');
    setFormData({
      email: '', username: '', first_name: '', last_name: '', phone: '',
      roles: [], is_active: true, is_verified: false, is_superuser: false, department_ids: [],
    });
    setPasswordData({ password: '', confirm_password: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenEditDialog = async (user) => {
    setDialogMode('edit');
    setSelectedUser(user);
    const assignments = await fetchUserDepartments(user.id);
    setFormData({
      email: user.email,
      username: user.username,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      roles: [...(user.roles || [])],
      is_active: user.is_active,
      is_verified: user.is_verified,
      is_superuser: user.is_superuser || false,
      department_ids: assignments.map(a => a.department_id),
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenDeleteDialog = (user) => { setDialogMode('delete'); setSelectedUser(user); setDialogOpen(true); };
  const handleOpenResetDialog = (user) => {
    setDialogMode('reset');
    setSelectedUser(user);
    setPasswordData({ password: '', confirm_password: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
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

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (dialogMode === 'create') {
        if (!validateCreateForm()) { setIsSubmitting(false); return; }
        await dispatch(createUser({
          ...formData,
          password: passwordData.password,
          department_ids: formData.department_ids,
        })).unwrap();
        setSnackbar({ open: true, message: 'User created successfully', severity: 'success' });
        setDialogOpen(false);
        loadUsers();
      } else if (dialogMode === 'edit') {
        if (!validateEditForm()) { setIsSubmitting(false); return; }
        await dispatch(updateUser({
          id: selectedUser.id,
          email: formData.email,
          username: formData.username,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          is_active: formData.is_active,
          is_verified: formData.is_verified,
          is_superuser: formData.is_superuser,
        })).unwrap();

        const currentRoles = [...(selectedUser.roles || [])].sort();
        const newRoles = [...(formData.roles || [])].sort();
        if (JSON.stringify(currentRoles) !== JSON.stringify(newRoles)) {
          await dispatch(updateUserRoles({ id: selectedUser.id, roles: [...newRoles] })).unwrap();
        }

        const currentDeptIds = (selectedUser.departments || []).map(d => d.id).sort();
        const newDeptIds = [...(formData.department_ids || [])].sort();
        if (JSON.stringify(currentDeptIds) !== JSON.stringify(newDeptIds)) {
          await api.post(`/users/${selectedUser.id}/departments`, { department_ids: newDeptIds });
          // Clear cache
          setUserDepartmentsMap(prev => ({ ...prev, [selectedUser.id]: null }));
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
      field: 'avatar', headerName: '', width: 52, sortable: false,
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        return (
          <Avatar sx={{ width: 34, height: 34, bgcolor: row.is_superuser ? 'warning.main' : 'primary.main', fontSize: 13, fontWeight: 700 }}>
            {row.first_name?.[0] || row.username?.[0] || 'U'}
          </Avatar>
        );
      },
    },
    {
      field: 'name', headerName: 'Name', minWidth: 180, flex: 1, sortable: true,
      valueGetter: (value, row) => [row?.first_name, row?.last_name].filter(Boolean).join(' ') || row?.username || '',
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ');
        return (
          <Box>
            <Typography variant="body2" fontWeight={600} noWrap>{fullName || row.username}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>@{row.username}</Typography>
          </Box>
        );
      },
    },
    {
      field: 'email', headerName: 'Email', minWidth: 200, flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <EmailOutlined fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
          <Typography variant="body2" noWrap>{params?.row?.email || ''}</Typography>
        </Box>
      ),
    },
    {
      field: 'departments', headerName: 'Departments', minWidth: 250, flex: 1,
      renderCell: (params) => {
        const row = params?.row;
        const assignments = userDepartmentsMap[row?.id] || [];
        const isLoadingDept = loadingUserDepts[row?.id];
        
        if (isLoadingDept) {
          return <CircularProgress size={20} />;
        }
        
        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
            {assignments.length === 0 && (
              <Typography variant="caption" color="text.disabled">No departments</Typography>
            )}
            {assignments.slice(0, 2).map(assignment => {
              const roleConfig = getDepartmentRoleChip(assignment.role);
              return (
                <Tooltip key={assignment.department_id} title={`Role: ${assignment.role}`}>
                  <Chip
                    label={assignment.department_name}
                    size="small"
                    variant="outlined"
                    color={roleConfig.color}
                    icon={roleConfig.icon || <BusinessOutlined sx={{ fontSize: 14 }} />}
                  />
                </Tooltip>
              );
            })}
            {assignments.length > 2 && (
              <Chip label={`+${assignments.length - 2}`} size="small" variant="outlined" />
            )}
          </Stack>
        );
      },
    },
    {
      field: 'is_superuser', headerName: 'Super Admin', width: 110, sortable: true,
      renderCell: (params) => {
        const isSuperAdmin = params?.row?.is_superuser;
        return isSuperAdmin ? (
          <Tooltip title="Full system access">
            <Chip label="Yes" size="small" color="warning" icon={<ShieldOutlined />} sx={{ fontWeight: 700 }} />
          </Tooltip>
        ) : (
          <Chip label="No" size="small" variant="outlined" sx={{ color: 'text.disabled' }} />
        );
      },
    },
    {
      field: 'roles', headerName: 'Roles', minWidth: 220, flex: 1,
      renderCell: (params) => {
        const roles = params?.row?.roles || [];
        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
            {roles.length === 0 && <Typography variant="caption" color="text.disabled">—</Typography>}
            {roles.map(roleCode => {
              const { name, color, description } = getRoleDetails(roleCode);
              return (
                <Tooltip key={roleCode} title={description || name}>
                  <Chip label={name} size="small" color={color} variant="outlined" sx={{ fontWeight: 600 }} />
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
              <Chip label="Verified" size="small" color="info" variant="outlined" icon={<VerifiedUserOutlined />} />
            )}
          </Stack>
        );
      },
    },
    {
      field: 'last_login', headerName: 'Last Login', width: 160,
      valueGetter: (value, row) => row?.last_login ? new Date(row.last_login).toLocaleString() : 'Never',
    },
    {
      field: 'actions', headerName: 'Actions', width: 200, sortable: false,
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Link to Department">
              <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleOpenDepartmentDialog(row); }}>
                <BusinessOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="View / Edit Details">
              <IconButton size="small" color="info" onClick={(e) => { e.stopPropagation(); handleOpenDetailPanel(row); }}>
                <OpenInNewOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Quick Edit">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenEditDialog(row); }}>
                <EditOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset Password">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenResetDialog(row); }}>
                <LockOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            {row.id !== currentUser?.id && !row.is_superuser && (
              <Tooltip title="Delete User">
                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleOpenDeleteDialog(row); }}>
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
  ], [currentUser, rolesList, userDepartmentsMap, loadingUserDepts]);

  // Mobile user card
  const UserCard = ({ user }) => {
    const isExpanded = expandedUser === user.id;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
    const isSelected = detailUser?.id === user.id;
    const assignments = userDepartmentsMap[user.id] || [];
    const isLoadingDept = loadingUserDepts[user.id];

    return (
      <Card
        sx={{
          mb: 1.5, borderRadius: 2.5, border: '1.5px solid',
          borderColor: isSelected ? 'primary.main' : user.is_superuser ? alpha(theme.palette.warning.main, 0.4) : 'divider',
          bgcolor: isSelected
            ? alpha(theme.palette.primary.main, 0.04)
            : user.is_superuser
            ? alpha(theme.palette.warning.main, 0.03)
            : 'background.paper',
          boxShadow: isSelected ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.15)}` : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <CardContent sx={{ pb: '8px !important', px: 2, pt: 2 }}>
          {/* Top row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <Box sx={{
                    width: 10, height: 10,
                    bgcolor: user.is_active ? 'success.main' : 'error.main',
                    borderRadius: '50%', border: '2px solid', borderColor: 'background.paper',
                  }} />
                }
              >
                <Avatar sx={{ bgcolor: user.is_superuser ? 'warning.main' : 'primary.main', width: 44, height: 44, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                  {user.first_name?.[0] || user.username?.[0] || 'U'}
                </Avatar>
              </Badge>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>{fullName}</Typography>
                  {user.is_superuser && (
                    <Chip label="Super Admin" size="small" color="warning" icon={<ShieldOutlined />} sx={{ fontWeight: 700, height: 20, fontSize: '0.65rem' }} />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" noWrap display="block">@{user.username}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <Tooltip title="Link Departments">
                <IconButton size="small" color="primary" onClick={() => handleOpenDepartmentDialog(user)}>
                  <BusinessOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="View Details">
                <IconButton size="small" color="info" onClick={() => handleOpenDetailPanel(user)}>
                  <OpenInNewOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => handleExpandUser(user.id)}>
                {isExpanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          </Box>

          {/* Departments section */}
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <ApartmentOutlined sx={{ fontSize: 12 }} />
              Departments ({assignments.length}):
            </Typography>
            {isLoadingDept ? (
              <CircularProgress size={20} />
            ) : assignments.length > 0 ? (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {assignments.map(assignment => {
                  const roleConfig = getDepartmentRoleChip(assignment.role);
                  return (
                    <Chip
                      key={assignment.department_id}
                      label={`${assignment.department_name} (${assignment.role})`}
                      size="small"
                      variant="outlined"
                      color={roleConfig.color}
                      icon={roleConfig.icon || <BusinessOutlined sx={{ fontSize: 14 }} />}
                      onDelete={() => handleUnlinkDepartment(user.id, assignment.department_id)}
                      deleteIcon={<LinkOffOutlined />}
                    />
                  );
                })}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                No departments assigned
              </Typography>
            )}
          </Box>

          {/* Status chips */}
          <Stack direction="row" spacing={0.75} sx={{ mt: 1.25, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip
              label={user.is_active ? 'Active' : 'Inactive'}
              size="small"
              color={user.is_active ? 'success' : 'default'}
              icon={user.is_active ? <LockOpenOutlined /> : <LockOutlined />}
            />
            {user.is_verified && (
              <Chip label="Verified" size="small" color="info" variant="outlined" icon={<VerifiedUserOutlined />} />
            )}
            {(user.roles || []).slice(0, 2).map(roleCode => {
              const { name, color } = getRoleDetails(roleCode);
              return <Chip key={roleCode} label={name} size="small" color={color} variant="outlined" sx={{ fontWeight: 600 }} />;
            })}
            {(user.roles || []).length > 2 && (
              <Chip label={`+${user.roles.length - 2}`} size="small" variant="outlined" />
            )}
          </Stack>
        </CardContent>

        <Collapse in={isExpanded}>
          <Divider />
          <CardContent sx={{ py: 1.5 }}>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailOutlined fontSize="small" sx={{ color: 'text.disabled' }} />
                <Typography variant="body2" noWrap>{user.email}</Typography>
              </Box>
              {user.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PhoneOutlined fontSize="small" sx={{ color: 'text.disabled' }} />
                  <Typography variant="body2">{user.phone}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShieldOutlined fontSize="small" sx={{ color: user.is_superuser ? 'warning.main' : 'text.disabled' }} />
                <Typography variant="body2" color={user.is_superuser ? 'warning.main' : 'text.secondary'} fontWeight={user.is_superuser ? 700 : 400}>
                  {user.is_superuser ? 'Super Administrator' : 'Not Super Admin'}
                </Typography>
              </Box>
              {assignments.length > 0 && (
                <Stack spacing={0.5}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary">Department Details:</Typography>
                  {assignments.map(assignment => (
                    <Paper key={assignment.department_id} variant="outlined" sx={{ p: 1, borderRadius: 1.5 }}>
                      <Typography variant="body2" fontWeight={600}>{assignment.department_name}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip label={`Role: ${assignment.role}`} size="small" variant="outlined" />
                        <Chip label={`Status: ${assignment.status}`} size="small" variant="outlined" />
                        {assignment.is_primary && <Chip label="Primary" size="small" color="primary" />}
                      </Stack>
                      {assignment.start_date && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Since: {new Date(assignment.start_date).toLocaleDateString()}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Stack>
              )}
              {(user.roles || []).length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  {(user.roles || []).map(roleCode => {
                    const { name, color } = getRoleDetails(roleCode);
                    return <Chip key={roleCode} label={name} size="small" color={color} variant="outlined" />;
                  })}
                </Stack>
              )}
              <Typography variant="caption" color="text.secondary">
                Last Login: {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
              </Typography>
            </Stack>
          </CardContent>
          <Divider />
          <Box sx={{ px: 1.5, py: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" startIcon={<BusinessOutlined />} onClick={() => handleOpenDepartmentDialog(user)} sx={{ flex: 1, minWidth: 80 }}>
              Link Dept
            </Button>
            <Button size="small" variant="outlined" startIcon={<EditOutlined />} onClick={() => handleOpenEditDialog(user)} sx={{ flex: 1, minWidth: 80 }}>
              Edit
            </Button>
            <Button size="small" variant="outlined" startIcon={<LockOutlined />} onClick={() => handleOpenResetDialog(user)} sx={{ flex: 1, minWidth: 80 }}>
              Reset PW
            </Button>
            {user.id !== currentUser?.id && !user.is_superuser && (
              <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlined />} onClick={() => handleOpenDeleteDialog(user)} sx={{ flex: 1, minWidth: 80 }}>
                Delete
              </Button>
            )}
          </Box>
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
    superadmins: users?.filter(u => u.is_superuser).length || 0,
  }), [users, total]);

  if (isLoading && (!users || users.length === 0)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const statCards = [
    { label: 'Total Users',  value: stats.total,       color: 'text.primary',   icon: <PeopleAltOutlined /> },
    { label: 'Active',       value: stats.active,      color: 'success.main',   icon: <LockOpenOutlined /> },
    { label: 'Verified',     value: stats.verified,    color: 'info.main',      icon: <VerifiedUserOutlined /> },
    { label: 'Admins',       value: stats.admins,      color: 'warning.main',   icon: <AdminPanelSettingsOutlined /> },
    { label: 'Super Admins', value: stats.superadmins, color: 'error.main',     icon: <ShieldOutlined /> },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 2, sm: 3 } }}>
        <Box>
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={800} gutterBottom sx={{ letterSpacing: -0.5, lineHeight: 1.2 }}>
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage system users, roles, permissions, and department assignments
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08), '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) } }}>
              <RefreshOutlined />
            </IconButton>
          </Tooltip>
          {isMobile && (
            <Button variant="contained" size="small" startIcon={<PersonAddOutlined />} onClick={handleOpenCreateDialog} sx={{ borderRadius: 1.5, fontWeight: 700 }}>
              Add
            </Button>
          )}
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' }, gap: { xs: 1, sm: 1.5 }, mb: { xs: 2, sm: 3 } }}>
        {statCards.map(({ label, value, color, icon }) => (
          <Paper key={label} elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.62rem' }}>
                {label}
              </Typography>
              <Box sx={{ color, display: 'flex', '& svg': { fontSize: 16 } }}>{icon}</Box>
            </Box>
            <Typography variant="h4" fontWeight={800} color={color} sx={{ lineHeight: 1 }}>{value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', gap: 1, mb: isMobile ? 1 : 0 }}>
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
                    <SearchOutlined fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          {isMobile && (
            <IconButton
              size="small"
              onClick={() => setShowFilters(v => !v)}
              sx={{ border: '1px solid', borderColor: showFilters ? 'primary.main' : 'divider', borderRadius: 1.5, color: showFilters ? 'primary.main' : 'text.secondary', bgcolor: showFilters ? alpha(theme.palette.primary.main, 0.08) : 'transparent', px: 1.5 }}
            >
              <FilterListOutlined fontSize="small" />
            </IconButton>
          )}
        </Box>
        <Collapse in={!isMobile || showFilters}>
          <Grid container spacing={1.5} alignItems="center" sx={{ mt: { xs: 0.5, sm: isMobile ? 0 : -1 } }}>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Role</InputLabel>
                <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} label="Role">
                  <MenuItem value="all">All Roles</MenuItem>
                  {rolesList?.map(role => (
                    <MenuItem key={role.id} value={role.code}>{role.name || role.code}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Super Admin</InputLabel>
                <Select value={superAdminFilter} onChange={(e) => setSuperAdminFilter(e.target.value)} label="Super Admin">
                  <MenuItem value="all">All Users</MenuItem>
                  <MenuItem value="yes">Super Admins Only</MenuItem>
                  <MenuItem value="no">Non-Super Admins</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} label="Department">
                  <MenuItem value="all">All Departments</MenuItem>
                  {departments.map(dept => (
                    <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {!isMobile && (
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                <Button fullWidth variant="contained" startIcon={<PersonAddOutlined />} onClick={handleOpenCreateDialog} sx={{ borderRadius: 1.5, fontWeight: 700 }}>
                  Add User
                </Button>
              </Grid>
            )}
          </Grid>
        </Collapse>
      </Paper>

      {/* Main layout */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Desktop DataGrid */}
          {!isMobile && (
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: 'background.paper' }}>
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
                      bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.04) : alpha(theme.palette.common.black, 0.02),
                      borderBottom: '1px solid', borderColor: 'divider',
                    },
                    '& .MuiDataGrid-row': { cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } },
                    '& .MuiDataGrid-cell': { borderColor: 'divider', py: 1 },
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
                <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Typography color="text.secondary">No users found</Typography>
                </Paper>
              )}
              {!isLoading && users?.map(user => <UserCard key={user.id} user={user} />)}
              {!isLoading && users?.length > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 1.5, alignItems: 'center' }}>
                  <Button variant="outlined" size="small" onClick={() => handlePageChange(page - 1)} disabled={page === 0} sx={{ borderRadius: 1.5 }}>
                    Previous
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    {page + 1} / {Math.ceil(total / rowsPerPage)}
                  </Typography>
                  <Button variant="outlined" size="small" onClick={() => handlePageChange(page + 1)} disabled={(page + 1) * rowsPerPage >= total} sx={{ borderRadius: 1.5 }}>
                    Next
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Side panel */}
        {detailUser && (
          <Box sx={{ width: { xs: '100%', md: 380 }, flexShrink: 0, height: isMobile ? 'auto' : 560, position: isMobile ? 'fixed' : 'sticky', top: isMobile ? 0 : 16, zIndex: isMobile ? 1200 : 1 }}>
            {isMobile && (
              <Box onClick={handleCloseDetailPanel} sx={{ position: 'fixed', inset: 0, bgcolor: alpha(theme.palette.common.black, 0.5), zIndex: -1 }} />
            )}
            <UserDetailPanel 
              user={detailUser} 
              onClose={handleCloseDetailPanel} 
              onUpdated={handleUserUpdated}
              departmentAssignments={userDepartmentsMap[detailUser.id] || []}
            />
          </Box>
        )}
      </Box>

      {/* Department Linking Dialog */}
      <Dialog open={departmentDialogOpen} onClose={() => !isSubmitting && setDepartmentDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2.5 } }}>
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessOutlined color="primary" />
            <Typography variant="h6" fontWeight={700}>Link Departments</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            User: {departmentUser?.first_name} {departmentUser?.last_name} (@{departmentUser?.username})
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Autocomplete
            multiple
            options={departments}
            getOptionLabel={(option) => option.name}
            getOptionKey={(option) => option.id}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={departments.filter(dept => selectedDepartments.includes(dept.id))}
            onChange={(event, newValue) => {
              setSelectedDepartments(newValue.map(dept => dept.id));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Departments"
                placeholder="Search departments..."
                variant="outlined"
                size="small"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  key={option.id}
                  label={option.name}
                  size="small"
                  color="primary"
                  {...getTagProps({ index })}
                />
              ))
            }
            loading={loadingDepartments}
            fullWidth
            sx={{ mt: 1 }}
          />
          {selectedDepartments.length > 0 && (
            <Alert severity="info" sx={{ mt: 2, borderRadius: 1.5 }}>
              User will be granted access to {selectedDepartments.length} selected department(s).
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
          <Button onClick={() => setDepartmentDialogOpen(false)} disabled={isSubmitting} sx={{ borderRadius: 1.5 }}>Cancel</Button>
          <Button onClick={handleLinkDepartments} variant="contained" disabled={isSubmitting} startIcon={isSubmitting ? <CircularProgress size={20} /> : <LinkOutlined />} sx={{ borderRadius: 1.5, minWidth: 130 }}>
            {isSubmitting ? 'Linking...' : 'Link Departments'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Main Dialog */}
      <Dialog open={dialogOpen} onClose={() => !isSubmitting && setDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2.5, border: isMobile ? 'none' : '1px solid', borderColor: 'divider' } }}
      >
        {/* ... Dialog content remains the same ... */}
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider', pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            {dialogMode === 'create' && 'Create New User'}
            {dialogMode === 'edit' && `Edit: ${selectedUser?.username}`}
            {dialogMode === 'delete' && 'Confirm Delete'}
            {dialogMode === 'reset' && `Reset Password: ${selectedUser?.username}`}
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={() => !isSubmitting && setDialogOpen(false)}>
              <CloseOutlined fontSize="small" />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: { xs: 2, sm: 3 } }}>
          {/* ... existing dialog content ... */}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={isSubmitting} sx={{ borderRadius: 1.5 }}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color={dialogMode === 'delete' ? 'error' : 'primary'} disabled={isSubmitting} sx={{ borderRadius: 1.5, minWidth: 130 }}>
            {isSubmitting ? <CircularProgress size={20} color="inherit" /> : (
              <>
                {dialogMode === 'create' && 'Create User'}
                {dialogMode === 'edit' && 'Save Changes'}
                {dialogMode === 'delete' && 'Delete User'}
                {dialogMode === 'reset' && 'Reset Password'}
              </>
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default UserManagement;