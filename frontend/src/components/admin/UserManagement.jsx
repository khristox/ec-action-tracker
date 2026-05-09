import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Container, Typography, Paper, TextField, Button, IconButton,
  Chip, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, FormControl, InputLabel, Select, MenuItem, Switch,
  FormControlLabel, Alert, Snackbar, CircularProgress, InputAdornment,
  Tooltip, Card, CardContent, Stack, Divider, useTheme, useMediaQuery,
  Collapse, Badge, alpha, Autocomplete, Fade, Slide,
} from '@mui/material';
import {
  SearchOutlined, EditOutlined, DeleteOutlined, LockOutlined,
  LockOpenOutlined, VerifiedUserOutlined, PersonAddOutlined,
  EmailOutlined, PhoneOutlined, ExpandMore, ExpandLess,
  RefreshOutlined, AdminPanelSettingsOutlined, OpenInNewOutlined,
  ShieldOutlined, PeopleAltOutlined, FilterListOutlined, CloseOutlined,
  BusinessOutlined, LinkOutlined, LinkOffOutlined, ApartmentOutlined,
  AccountTreeOutlined, SupervisorAccountOutlined, CheckCircleOutlined,
  CancelOutlined, TuneOutlined,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import {
  fetchUsers, createUser, updateUser, deleteUser,
  resetUserPassword, updateUserRoles,
} from '../../store/slices/adminSlice';
import { fetchRoles, selectAllRoles, selectRolesLoading } from '../../store/slices/roleSlice';
import api from '../../services/api';
import UserDetailPanel from './UserDetailPanel';

// ─── Design tokens ────────────────────────────────────────────────────────────
const ROLE_PALETTE = {
  head:        { color: 'error',   label: 'Head' },
  manager:     { color: 'warning', label: 'Manager' },
  supervisor:  { color: 'info',    label: 'Supervisor' },
  member:      { color: 'default', label: 'Member' },
  temporary:   { color: 'warning', label: 'Temp' },
  contractor:  { color: 'default', label: 'Contractor' },
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const initials = (u) =>
  u?.first_name?.[0]?.toUpperCase() || u?.username?.[0]?.toUpperCase() || 'U';

const fullName = (u) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || '—';

// ─── Inline department pill with unlink ──────────────────────────────────────
const DeptPill = ({ assignment, onUnlink, compact = false }) => {
  const cfg = ROLE_PALETTE[assignment.role] || ROLE_PALETTE.member;
  return (
    <Tooltip title={`${assignment.department_name} · ${assignment.role}`} arrow>
      <Chip
        label={compact ? assignment.department_name?.split(' ')[0] : assignment.department_name}
        size="small"
        color={cfg.color}
        variant="outlined"
        onDelete={onUnlink ? () => onUnlink(assignment.department_id) : undefined}
        deleteIcon={onUnlink ? <LinkOffOutlined sx={{ fontSize: '13px !important' }} /> : undefined}
        sx={{ maxWidth: 140, fontSize: '0.72rem', height: 22 }}
      />
    </Tooltip>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color }) => (
  <Paper
    elevation={0}
    sx={{
      p: { xs: 1.5, sm: 2 },
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={600}
        sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: '0.62rem' }}
      >
        {label}
      </Typography>
      <Box sx={{ color, '& svg': { fontSize: 16 } }}>{icon}</Box>
    </Box>
    <Typography variant="h4" fontWeight={800} color={color} sx={{ lineHeight: 1 }}>
      {value}
    </Typography>
  </Paper>
);

// ─── Department link dialog ───────────────────────────────────────────────────
const DepartmentDialog = ({
  open, onClose, user, departments, currentAssignments, onSave, saving,
}) => {
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open) setSelected(currentAssignments.map((a) => a.department_id));
  }, [open, currentAssignments]);

  const selectedObjs = departments.filter((d) => selected.includes(d.id));
  const toAdd    = selected.filter((id) => !currentAssignments.find((a) => a.department_id === id));
  const toRemove = currentAssignments.filter((a) => !selected.includes(a.department_id));

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Fade}
      PaperProps={{ sx: { borderRadius: 2.5 } }}
    >
      <DialogTitle sx={{ pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: 1.5,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <BusinessOutlined color="primary" fontSize="small" />
          </Box>
          <Box>
            <Typography fontWeight={700}>Department access</Typography>
            <Typography variant="caption" color="text.secondary">
              {fullName(user)} · @{user?.username}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        <Autocomplete
          multiple
          options={departments}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          value={selectedObjs}
          onChange={(_, newVal) => setSelected(newVal.map((d) => d.id))}
          renderInput={(params) => (
            <TextField {...params} label="Select departments" placeholder="Search…" size="small" />
          )}
          renderTags={(value, getTagProps) =>
            value.map((opt, i) => (
              <Chip
                key={opt.id}
                label={opt.name}
                size="small"
                color="primary"
                variant="outlined"
                {...getTagProps({ index: i })}
              />
            ))
          }
          fullWidth
        />

        {/* Diff preview */}
        {(toAdd.length > 0 || toRemove.length > 0) && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {toAdd.map((id) => {
              const d = departments.find((x) => x.id === id);
              return (
                <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleOutlined sx={{ fontSize: 15, color: 'success.main' }} />
                  <Typography variant="caption" color="success.main">
                    Add: {d?.name}
                  </Typography>
                </Box>
              );
            })}
            {toRemove.map((a) => (
              <Box key={a.department_id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CancelOutlined sx={{ fontSize: 15, color: 'error.main' }} />
                <Typography variant="caption" color="error.main">
                  Remove: {a.department_name}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          onClick={() => onSave(selected, toRemove.map((a) => a.department_id))}
          variant="contained"
          disabled={saving || (toAdd.length === 0 && toRemove.length === 0)}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <LinkOutlined />}
          sx={{ minWidth: 130 }}
        >
          {saving ? 'Saving…' : `Save (${toAdd.length + toRemove.length} change${toAdd.length + toRemove.length !== 1 ? 's' : ''})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const UserManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const { users, isLoading, total } = useSelector((s) => s.admin);
  const { user: currentUser } = useSelector((s) => s.auth);
  const rolesList = useSelector(selectAllRoles);

  // Pagination / search / filter
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 5 : 10);
  const [searchTerm, setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter]         = useState('all');
  const [roleFilter, setRoleFilter]             = useState('all');
  const [superAdminFilter, setSuperAdminFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showFilters, setShowFilters]           = useState(false);

  // Dialogs / panels
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [dialogMode, setDialogMode]   = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailUser, setDetailUser]   = useState(null);

  // Department dialog
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [deptDialogUser, setDeptDialogUser] = useState(null);
  const [savingDepts, setSavingDepts]       = useState(false);

  // Data
  const [departments, setDepartments]         = useState([]);
  const [userDepartmentsMap, setUserDeptMap]  = useState({});
  const [loadingUserDepts, setLoadingUserDepts] = useState({});

  // Form
  const [formData, setFormData] = useState({
    email: '', username: '', first_name: '', last_name: '', phone: '',
    roles: [], is_active: true, is_verified: false, is_superuser: false,
    department_ids: [],
  });
  const [passwordData, setPasswordData] = useState({ password: '', confirm_password: '' });
  const [formErrors, setFormErrors]     = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [snackbar, setSnackbar]         = useState({ open: false, message: '', severity: 'success' });

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchDepartments = useCallback(async () => {
    try {
      const r = await api.get('/departments');
      setDepartments(r.data || []);
    } catch { setDepartments([]); }
  }, []);

  const fetchUserDepts = useCallback(async (userId, force = false) => {
    if (!force && (userDepartmentsMap[userId] || loadingUserDepts[userId])) return;
    setLoadingUserDepts((p) => ({ ...p, [userId]: true }));
    try {
      const r = await api.get(`/users/${userId}/departments`);
      setUserDeptMap((p) => ({ ...p, [userId]: r.data || [] }));
    } catch {
      setUserDeptMap((p) => ({ ...p, [userId]: [] }));
    } finally {
      setLoadingUserDepts((p) => ({ ...p, [userId]: false }));
    }
  }, [userDepartmentsMap, loadingUserDepts]);

  useEffect(() => { dispatch(fetchRoles()); fetchDepartments(); }, [dispatch]);

  const loadUsers = useCallback(() => {
    dispatch(fetchUsers({
      page: page + 1, limit: rowsPerPage, search: searchTerm,
      is_active: statusFilter !== 'all' ? statusFilter === 'active' : undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      is_superuser: superAdminFilter !== 'all' ? superAdminFilter === 'yes' : undefined,
      department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
    }));
  }, [dispatch, page, rowsPerPage, searchTerm, statusFilter, roleFilter, superAdminFilter, departmentFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  useEffect(() => {
    if (users?.length) {
      users.forEach((u) => { if (!userDepartmentsMap[u.id]) fetchUserDepts(u.id); });
    }
  }, [users]);

  // ── Department save handler ──────────────────────────────────────────────────
  const handleSaveDepartments = async (selectedIds, removeIds) => {
    if (!deptDialogUser) return;
    setSavingDepts(true);
    try {
      const currentIds = (userDepartmentsMap[deptDialogUser.id] || []).map((a) => a.department_id);
      const toAdd    = selectedIds.filter((id) => !currentIds.includes(id));

      // Add new ones in bulk
      if (toAdd.length > 0) {
        await api.post(`/users/${deptDialogUser.id}/departments`, {
          department_ids: toAdd,
          role: 'member',
        });
      }
      // Remove individually
      for (const deptId of removeIds) {
        await api.delete(`/users/${deptDialogUser.id}/departments/${deptId}`);
      }

      await fetchUserDepts(deptDialogUser.id, true);
      setSnackbar({ open: true, message: 'Department access updated', severity: 'success' });
      setDeptDialogOpen(false);
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.detail || 'Failed to update departments', severity: 'error' });
    } finally {
      setSavingDepts(false);
    }
  };

  const handleUnlinkDept = async (userId, deptId) => {
    try {
      await api.delete(`/users/${userId}/departments/${deptId}`);
      await fetchUserDepts(userId, true);
      setSnackbar({ open: true, message: 'Department removed', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to remove department', severity: 'error' });
    }
  };

  // ── Row helpers ──────────────────────────────────────────────────────────────
  const getRoleDetails = (roleCode) => {
    const role = rolesList?.find((r) => r.code === roleCode);
    return {
      name: role?.name || roleCode,
      color: roleCode === 'admin' ? 'error' : roleCode === 'super_admin' ? 'warning' : 'primary',
    };
  };

  // ── DataGrid columns ─────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      field: 'avatar', headerName: '', width: 52, sortable: false,
      renderCell: ({ row }) => row ? (
        <Avatar
          sx={{
            width: 34, height: 34, fontSize: 13, fontWeight: 700,
            bgcolor: row.is_superuser ? 'warning.main' : 'primary.main',
          }}
        >
          {initials(row)}
        </Avatar>
      ) : null,
    },
    {
      field: 'name', headerName: 'Name', minWidth: 180, flex: 1,
      valueGetter: (_, row) => fullName(row),
      renderCell: ({ row }) => row ? (
        <Box>
          <Typography variant="body2" fontWeight={600} noWrap>{fullName(row)}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>@{row.username}</Typography>
        </Box>
      ) : null,
    },
    {
      field: 'email', headerName: 'Email', minWidth: 200, flex: 1,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <EmailOutlined fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
          <Typography variant="body2" noWrap>{row?.email}</Typography>
        </Box>
      ),
    },
    {
      field: 'departments', headerName: 'Departments', minWidth: 240, flex: 1, sortable: false,
      renderCell: ({ row }) => {
        if (!row) return null;
        const assignments = userDepartmentsMap[row.id] || [];
        if (loadingUserDepts[row.id]) return <CircularProgress size={18} />;
        if (!assignments.length)
          return <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>None</Typography>;
        return (
          <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
            {assignments.slice(0, 2).map((a) => (
              <DeptPill
                key={a.department_id}
                assignment={a}
                onUnlink={(deptId) => handleUnlinkDept(row.id, deptId)}
                compact
              />
            ))}
            {assignments.length > 2 && (
              <Chip
                label={`+${assignments.length - 2}`}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.72rem' }}
              />
            )}
          </Stack>
        );
      },
    },
    {
      field: 'is_superuser', headerName: 'Super Admin', width: 115, sortable: true,
      renderCell: ({ row }) => row?.is_superuser ? (
        <Chip label="Yes" size="small" color="warning" icon={<ShieldOutlined />} sx={{ fontWeight: 700 }} />
      ) : (
        <Chip label="No" size="small" variant="outlined" sx={{ color: 'text.disabled' }} />
      ),
    },
    {
      field: 'roles', headerName: 'Roles', minWidth: 200, flex: 1, sortable: false,
      renderCell: ({ row }) => {
        const roles = row?.roles || [];
        if (!roles.length) return <Typography variant="caption" color="text.disabled">—</Typography>;
        return (
          <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
            {roles.slice(0, 3).map((code) => {
              const { name, color } = getRoleDetails(code);
              return (
                <Chip key={code} label={name} size="small" color={color} variant="outlined"
                  sx={{ fontWeight: 600, height: 22, fontSize: '0.72rem' }} />
              );
            })}
            {roles.length > 3 && (
              <Chip label={`+${roles.length - 3}`} size="small" variant="outlined"
                sx={{ height: 22, fontSize: '0.72rem' }} />
            )}
          </Stack>
        );
      },
    },
    {
      field: 'status', headerName: 'Status', width: 130, sortable: false,
      renderCell: ({ row }) => row ? (
        <Stack spacing={0.5}>
          <Chip
            label={row.is_active ? 'Active' : 'Inactive'}
            size="small"
            color={row.is_active ? 'success' : 'default'}
            icon={row.is_active ? <LockOpenOutlined /> : <LockOutlined />}
          />
          {row.is_verified && (
            <Chip label="Verified" size="small" color="info" variant="outlined"
              icon={<VerifiedUserOutlined />} />
          )}
        </Stack>
      ) : null,
    },
    {
      field: 'last_login', headerName: 'Last Login', width: 155,
      valueGetter: (_, row) => row?.last_login ? new Date(row.last_login).toLocaleString() : 'Never',
    },
    {
      field: 'actions', headerName: 'Actions', width: 190, sortable: false,
      renderCell: ({ row }) => row ? (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="Manage departments">
            <IconButton size="small" color="primary"
              onClick={(e) => { e.stopPropagation(); setDeptDialogUser(row); setDeptDialogOpen(true); }}>
              <BusinessOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="View details">
            <IconButton size="small" color="info"
              onClick={(e) => { e.stopPropagation(); handleOpenDetail(row); }}>
              <OpenInNewOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small"
              onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}>
              <EditOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset password">
            <IconButton size="small"
              onClick={(e) => { e.stopPropagation(); handleOpenReset(row); }}>
              <LockOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          {row.id !== currentUser?.id && !row.is_superuser && (
            <Tooltip title="Delete">
              <IconButton size="small" color="error"
                onClick={(e) => { e.stopPropagation(); handleOpenDelete(row); }}>
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ) : null,
    },
  ], [currentUser, rolesList, userDepartmentsMap, loadingUserDepts]);

  // ── Dialog helpers ───────────────────────────────────────────────────────────
  const handleOpenDetail = async (user) => {
    setDetailUser(user);
    await fetchUserDepts(user.id);
  };

  const handleOpenEdit = async (user) => {
    setDialogMode('edit');
    setSelectedUser(user);
    const assignments = userDepartmentsMap[user.id] || [];
    setFormData({
      email: user.email, username: user.username,
      first_name: user.first_name || '', last_name: user.last_name || '',
      phone: user.phone || '', roles: [...(user.roles || [])],
      is_active: user.is_active, is_verified: user.is_verified,
      is_superuser: user.is_superuser || false,
      department_ids: assignments.map((a) => a.department_id),
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenDelete = (user) => { setDialogMode('delete'); setSelectedUser(user); setDialogOpen(true); };
  const handleOpenReset  = (user) => {
    setDialogMode('reset'); setSelectedUser(user);
    setPasswordData({ password: '', confirm_password: '' });
    setFormErrors({});
    setDialogOpen(true);
  };
  const handleOpenCreate = () => {
    setDialogMode('create');
    setFormData({ email:'', username:'', first_name:'', last_name:'', phone:'',
      roles:[], is_active:true, is_verified:false, is_superuser:false, department_ids:[] });
    setPasswordData({ password:'', confirm_password:'' });
    setFormErrors({});
    setDialogOpen(true);
  };

  // ── Form validation / submit ─────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!formData.email) e.email = 'Required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Invalid email';
    if (!formData.username || formData.username.length < 3) e.username = 'Min 3 chars';
    if (dialogMode === 'create') {
      if (!passwordData.password || passwordData.password.length < 8) e.password = 'Min 8 chars';
      if (passwordData.password !== passwordData.confirm_password) e.confirm_password = 'Mismatch';
    }
    if (dialogMode === 'reset') {
      if (!passwordData.password || passwordData.password.length < 8) e.password = 'Min 8 chars';
      if (passwordData.password !== passwordData.confirm_password) e.confirm_password = 'Mismatch';
    }
    setFormErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      if (dialogMode === 'create') {
        await dispatch(createUser({ ...formData, password: passwordData.password })).unwrap();
        setSnackbar({ open: true, message: 'User created', severity: 'success' });
      } else if (dialogMode === 'edit') {
        await dispatch(updateUser({
          id: selectedUser.id, email: formData.email, username: formData.username,
          first_name: formData.first_name, last_name: formData.last_name,
          phone: formData.phone, is_active: formData.is_active,
          is_verified: formData.is_verified, is_superuser: formData.is_superuser,
        })).unwrap();

        const prevRoles = [...(selectedUser.roles || [])].sort();
        const nextRoles = [...(formData.roles || [])].sort();
        if (JSON.stringify(prevRoles) !== JSON.stringify(nextRoles))
          await dispatch(updateUserRoles({ id: selectedUser.id, roles: nextRoles })).unwrap();

        const prevDepts = (userDepartmentsMap[selectedUser.id] || []).map((a) => a.department_id).sort();
        const nextDepts = [...(formData.department_ids || [])].sort();
        if (JSON.stringify(prevDepts) !== JSON.stringify(nextDepts)) {
          const toAdd = nextDepts.filter((id) => !prevDepts.includes(id));
          const toRm  = prevDepts.filter((id) => !nextDepts.includes(id));
          if (toAdd.length)
            await api.post(`/users/${selectedUser.id}/departments`, { department_ids: toAdd, role: 'member' });
          for (const dId of toRm)
            await api.delete(`/users/${selectedUser.id}/departments/${dId}`);
          await fetchUserDepts(selectedUser.id, true);
        }
        setSnackbar({ open: true, message: 'User updated', severity: 'success' });
      } else if (dialogMode === 'delete') {
        await dispatch(deleteUser(selectedUser.id)).unwrap();
        if (detailUser?.id === selectedUser.id) setDetailUser(null);
        setSnackbar({ open: true, message: 'User deleted', severity: 'success' });
      } else if (dialogMode === 'reset') {
        await dispatch(resetUserPassword({ user_id: selectedUser.id, new_password: passwordData.password })).unwrap();
        setSnackbar({ open: true, message: 'Password reset', severity: 'success' });
      }
      setDialogOpen(false);
      loadUsers();
    } catch (err) {
      setSnackbar({ open: true, message: err.message || `${dialogMode} failed`, severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:      total || 0,
    active:     users?.filter((u) => u.is_active).length || 0,
    verified:   users?.filter((u) => u.is_verified).length || 0,
    admins:     users?.filter((u) => u.roles?.includes('admin')).length || 0,
    superadmins: users?.filter((u) => u.is_superuser).length || 0,
  }), [users, total]);

  const STAT_CARDS = [
    { label: 'Total users',  value: stats.total,       icon: <PeopleAltOutlined />,           color: 'text.primary' },
    { label: 'Active',       value: stats.active,      icon: <LockOpenOutlined />,             color: 'success.main' },
    { label: 'Verified',     value: stats.verified,    icon: <VerifiedUserOutlined />,         color: 'info.main' },
    { label: 'Admins',       value: stats.admins,      icon: <AdminPanelSettingsOutlined />,   color: 'warning.main' },
    { label: 'Super admins', value: stats.superadmins, icon: <ShieldOutlined />,               color: 'error.main' },
  ];

  // ── Mobile card ──────────────────────────────────────────────────────────────
  const UserCard = ({ user }) => {
    const expanded   = expandedUser === user.id;
    const selected   = detailUser?.id === user.id;
    const assignments = userDepartmentsMap[user.id] || [];
    const isLoadingD  = loadingUserDepts[user.id];

    return (
      <Card
        sx={{
          mb: 1.5, borderRadius: 2.5, border: '1.5px solid',
          borderColor: selected ? 'primary.main' : user.is_superuser
            ? (t) => alpha(t.palette.warning.main, 0.4) : 'divider',
          transition: 'all 0.18s ease',
        }}
      >
        <CardContent sx={{ pb: '8px !important', px: 2, pt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Avatar sx={{ bgcolor: user.is_superuser ? 'warning.main' : 'primary.main', width: 42, height: 42, fontWeight: 700 }}>
                {initials(user)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700} noWrap>{fullName(user)}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>@{user.username}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 0.25 }}>
              <Tooltip title="Manage departments">
                <IconButton size="small" color="primary"
                  onClick={() => { setDeptDialogUser(user); setDeptDialogOpen(true); }}>
                  <BusinessOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="View details">
                <IconButton size="small" color="info" onClick={() => handleOpenDetail(user)}>
                  <OpenInNewOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => setExpandedUser(expanded ? null : user.id)}>
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          </Box>

          {/* Department pills */}
          <Box sx={{ mt: 1.25 }}>
            {isLoadingD ? <CircularProgress size={18} /> : assignments.length > 0 ? (
              <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                {assignments.map((a) => (
                  <DeptPill
                    key={a.department_id}
                    assignment={a}
                    onUnlink={(dId) => handleUnlinkDept(user.id, dId)}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>No departments</Typography>
            )}
          </Box>

          <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip
              label={user.is_active ? 'Active' : 'Inactive'}
              size="small"
              color={user.is_active ? 'success' : 'default'}
              icon={user.is_active ? <LockOpenOutlined /> : <LockOutlined />}
            />
            {user.is_verified && <Chip label="Verified" size="small" color="info" variant="outlined" />}
            {(user.roles || []).slice(0, 2).map((c) => {
              const { name, color } = getRoleDetails(c);
              return <Chip key={c} label={name} size="small" color={color} variant="outlined" sx={{ fontWeight: 600 }} />;
            })}
          </Stack>
        </CardContent>

        <Collapse in={expanded}>
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
              <Typography variant="caption" color="text.secondary">
                Last login: {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
              </Typography>
            </Stack>
          </CardContent>
          <Divider />
          <Box sx={{ px: 1.5, py: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" startIcon={<EditOutlined />}
              onClick={() => handleOpenEdit(user)} sx={{ flex: 1, minWidth: 80 }}>Edit</Button>
            <Button size="small" variant="outlined" startIcon={<LockOutlined />}
              onClick={() => handleOpenReset(user)} sx={{ flex: 1, minWidth: 80 }}>Reset PW</Button>
            {user.id !== currentUser?.id && !user.is_superuser && (
              <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlined />}
                onClick={() => handleOpenDelete(user)} sx={{ flex: 1, minWidth: 80 }}>Delete</Button>
            )}
          </Box>
        </Collapse>
      </Card>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 } }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={800} sx={{ letterSpacing: -0.5 }}>
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage users, roles, permissions, and department assignments
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Refresh">
            <IconButton
              onClick={() => { setUserDeptMap({}); loadUsers(); dispatch(fetchRoles()); fetchDepartments(); setSnackbar({ open: true, message: 'Refreshed', severity: 'success' }); }}
              sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }}
            >
              <RefreshOutlined />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            size={isMobile ? 'small' : 'medium'}
            startIcon={<PersonAddOutlined />}
            onClick={handleOpenCreate}
            sx={{ borderRadius: 1.5, fontWeight: 700 }}
          >
            {isMobile ? 'Add' : 'Add User'}
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(5,1fr)' }, gap: 1.5, mb: 3 }}>
        {STAT_CARDS.map((s) => <StatCard key={s.label} {...s} />)}
      </Box>

      {/* Search + filters */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            placeholder="Search users…"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
          <Tooltip title={showFilters ? 'Hide filters' : 'Show filters'}>
            <IconButton
              size="small"
              onClick={() => setShowFilters((v) => !v)}
              sx={{
                border: '1px solid', borderRadius: 1.5, px: 1.5,
                borderColor: showFilters ? 'primary.main' : 'divider',
                color: showFilters ? 'primary.main' : 'text.secondary',
                bgcolor: showFilters ? (t) => alpha(t.palette.primary.main, 0.06) : 'transparent',
              }}
            >
              <TuneOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Collapse in={showFilters || !isMobile}>
          <Grid container spacing={1.5} sx={{ mt: 1 }}>
            {[
              { label: 'Status', value: statusFilter, set: setStatusFilter,
                opts: [['all','All statuses'],['active','Active'],['inactive','Inactive']] },
              { label: 'Role', value: roleFilter, set: setRoleFilter,
                opts: [['all','All roles'], ...(rolesList||[]).map((r) => [r.code, r.name])] },
              { label: 'Super admin', value: superAdminFilter, set: setSuperAdminFilter,
                opts: [['all','All users'],['yes','Super admins'],['no','Standard users']] },
              { label: 'Department', value: departmentFilter, set: setDepartmentFilter,
                opts: [['all','All departments'], ...departments.map((d) => [d.id, d.name])] },
            ].map(({ label, value, set, opts }) => (
              <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>{label}</InputLabel>
                  <Select value={value} onChange={(e) => { set(e.target.value); setPage(0); }} label={label}>
                    {opts.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            ))}
          </Grid>
        </Collapse>
      </Paper>

      {/* Main layout */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>

          {/* Desktop DataGrid */}
          {!isMobile && (
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
              <DataGrid
                rows={users || []}
                columns={columns}
                loading={isLoading}
                rowCount={total || 0}
                paginationMode="server"
                pageSizeOptions={[10, 25, 50]}
                paginationModel={{ page, pageSize: rowsPerPage }}
                onPaginationModelChange={(m) => { setPage(m.page); setRowsPerPage(m.pageSize); }}
                disableRowSelectionOnClick
                getRowId={(r) => r.id}
                onRowClick={(p) => handleOpenDetail(p.row)}
                autoHeight
                sx={{
                  border: 'none',
                  '& .MuiDataGrid-columnHeaders': {
                    bgcolor: (t) => t.palette.mode === 'dark'
                      ? alpha(t.palette.common.white, 0.03)
                      : alpha(t.palette.common.black, 0.02),
                  },
                  '& .MuiDataGrid-row': { cursor: 'pointer', '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) } },
                  '& .MuiDataGrid-cell': { borderColor: 'divider', py: 1, alignItems: 'center' },
                }}
              />
            </Paper>
          )}

          {/* Mobile cards */}
          {isMobile && (
            <Box>
              {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
              {!isLoading && !users?.length && (
                <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Typography color="text.secondary">No users found</Typography>
                </Paper>
              )}
              {!isLoading && users?.map((u) => <UserCard key={u.id} user={u} />)}
              {!isLoading && users?.length > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 1.5, alignItems: 'center' }}>
                  <Button variant="outlined" size="small" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>Prev</Button>
                  <Typography variant="body2" color="text.secondary">{page + 1} / {Math.ceil(total / rowsPerPage)}</Typography>
                  <Button variant="outlined" size="small" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * rowsPerPage >= total}>Next</Button>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Side detail panel */}
        {detailUser && (
          <Box sx={{
            width: { xs: '100%', md: 370 }, flexShrink: 0,
            position: isMobile ? 'fixed' : 'sticky', top: isMobile ? 0 : 16,
            zIndex: isMobile ? 1200 : 1,
          }}>
            {isMobile && (
              <Box onClick={() => setDetailUser(null)}
                sx={{ position: 'fixed', inset: 0, bgcolor: (t) => alpha(t.palette.common.black, 0.5), zIndex: -1 }} />
            )}
            <UserDetailPanel
              user={detailUser}
              onClose={() => setDetailUser(null)}
              onUpdated={() => { setUserDeptMap({}); loadUsers(); }}
              departmentAssignments={userDepartmentsMap[detailUser.id] || []}
            />
          </Box>
        )}
      </Box>

      {/* Department dialog */}
      <DepartmentDialog
        open={deptDialogOpen}
        onClose={() => setDeptDialogOpen(false)}
        user={deptDialogUser}
        departments={departments}
        currentAssignments={userDepartmentsMap[deptDialogUser?.id] || []}
        onSave={handleSaveDepartments}
        saving={savingDepts}
      />

      {/* Create / edit / delete / reset dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => !isSubmitting && setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        TransitionComponent={Fade}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider', pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            {dialogMode === 'create' && 'Create new user'}
            {dialogMode === 'edit'   && `Edit · ${selectedUser?.username}`}
            {dialogMode === 'delete' && 'Confirm delete'}
            {dialogMode === 'reset'  && `Reset password · ${selectedUser?.username}`}
          </span>
          {isMobile && (
            <IconButton size="small" onClick={() => !isSubmitting && setDialogOpen(false)}>
              <CloseOutlined fontSize="small" />
            </IconButton>
          )}
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5, px: { xs: 2, sm: 3 } }}>
          {dialogMode === 'delete' ? (
            <Alert severity="error" sx={{ borderRadius: 1.5 }}>
              Delete <strong>{fullName(selectedUser)}</strong> permanently? This cannot be undone.
            </Alert>
          ) : dialogMode === 'reset' ? (
            <Stack spacing={2}>
              <TextField label="New password" name="password" type="password" size="small" fullWidth
                value={passwordData.password}
                onChange={(e) => setPasswordData((p) => ({ ...p, password: e.target.value }))}
                error={!!formErrors.password} helperText={formErrors.password} />
              <TextField label="Confirm password" name="confirm_password" type="password" size="small" fullWidth
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData((p) => ({ ...p, confirm_password: e.target.value }))}
                error={!!formErrors.confirm_password} helperText={formErrors.confirm_password} />
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="First name" name="first_name" size="small" fullWidth
                    value={formData.first_name}
                    onChange={(e) => setFormData((p) => ({ ...p, first_name: e.target.value }))} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Last name" name="last_name" size="small" fullWidth
                    value={formData.last_name}
                    onChange={(e) => setFormData((p) => ({ ...p, last_name: e.target.value }))} />
                </Grid>
              </Grid>
              <TextField label="Email" name="email" size="small" fullWidth required
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                error={!!formErrors.email} helperText={formErrors.email} />
              <TextField label="Username" name="username" size="small" fullWidth required
                value={formData.username}
                onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                error={!!formErrors.username} helperText={formErrors.username} />
              <TextField label="Phone" name="phone" size="small" fullWidth
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} />

              {dialogMode === 'create' && (
                <>
                  <TextField label="Password" name="password" type="password" size="small" fullWidth required
                    value={passwordData.password}
                    onChange={(e) => setPasswordData((p) => ({ ...p, password: e.target.value }))}
                    error={!!formErrors.password} helperText={formErrors.password} />
                  <TextField label="Confirm password" name="confirm_password" type="password" size="small" fullWidth required
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData((p) => ({ ...p, confirm_password: e.target.value }))}
                    error={!!formErrors.confirm_password} helperText={formErrors.confirm_password} />
                </>
              )}

              <FormControl size="small" fullWidth>
                <InputLabel>Roles</InputLabel>
                <Select multiple value={formData.roles} label="Roles"
                  onChange={(e) => setFormData((p) => ({ ...p, roles: e.target.value }))}
                  renderValue={(sel) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {sel.map((v) => <Chip key={v} label={getRoleDetails(v).name} size="small" />)}
                    </Box>
                  )}
                >
                  {(rolesList || []).map((r) => (
                    <MenuItem key={r.id} value={r.code}>{r.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Autocomplete
                multiple
                options={departments}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={departments.filter((d) => formData.department_ids.includes(d.id))}
                onChange={(_, v) => setFormData((p) => ({ ...p, department_ids: v.map((d) => d.id) }))}
                renderInput={(params) => <TextField {...params} label="Departments" size="small" />}
                renderTags={(val, getTagProps) =>
                  val.map((opt, i) => (
                    <Chip key={opt.id} label={opt.name} size="small" {...getTagProps({ index: i })} />
                  ))
                }
              />

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={<Switch checked={formData.is_active}
                    onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))} />}
                  label="Active"
                />
                <FormControlLabel
                  control={<Switch checked={formData.is_verified}
                    onChange={(e) => setFormData((p) => ({ ...p, is_verified: e.target.checked }))} />}
                  label="Verified"
                />
                <FormControlLabel
                  control={<Switch checked={formData.is_superuser} color="warning"
                    onChange={(e) => setFormData((p) => ({ ...p, is_superuser: e.target.checked }))} />}
                  label="Super admin"
                />
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color={dialogMode === 'delete' ? 'error' : 'primary'}
            disabled={isSubmitting}
            sx={{ minWidth: 130 }}
          >
            {isSubmitting ? <CircularProgress size={20} color="inherit" /> : (
              <>
                {dialogMode === 'create' && 'Create user'}
                {dialogMode === 'edit'   && 'Save changes'}
                {dialogMode === 'delete' && 'Delete user'}
                {dialogMode === 'reset'  && 'Reset password'}
              </>
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default UserManagement;