import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  InputAdornment,
  Divider,
  alpha,
  useTheme,
  useMediaQuery,
  Badge,
} from '@mui/material';
import {
  AddOutlined,
  EditOutlined,
  DeleteOutlined,
  SecurityOutlined,
  GroupOutlined,
  SaveOutlined,
  ShieldOutlined,
  RefreshOutlined,
  SearchOutlined,
  CheckBoxOutlined,
  CloseOutlined,
  DoneAllOutlined,
  RemoveDoneOutlined,
  FilterListOutlined,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchPermissions,
  assignPermissions,
} from '../../store/slices/roleSlice';

// ─────────────────────────────────────────────
// Permission Picker
// ─────────────────────────────────────────────
const PermissionPicker = ({ permissions = [], selected = [], onChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  const grouped = useMemo(() => {
    return permissions.reduce((acc, perm) => {
      const cat = perm.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    }, {});
  }, [permissions]);

  const categories = useMemo(() => Object.keys(grouped), [grouped]);

  useEffect(() => {
    if (categories.length && !activeCategory) setActiveCategory(categories[0]);
  }, [categories, activeCategory]);

  const visiblePerms = useMemo(() => {
    const pool = search.trim()
      ? permissions.filter(
          p =>
            p.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.code?.toLowerCase().includes(search.toLowerCase())
        )
      : activeCategory
      ? grouped[activeCategory] || []
      : permissions;
    return pool;
  }, [search, activeCategory, permissions, grouped]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = id => {
    const next = new Set(selectedSet);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange([...next]);
  };

  const toggleCategory = cat => {
    const catIds = (grouped[cat] || []).map(p => p.id);
    const allSelected = catIds.every(id => selectedSet.has(id));
    const next = new Set(selectedSet);
    catIds.forEach(id => (allSelected ? next.delete(id) : next.add(id)));
    onChange([...next]);
  };

  const clearAll = () => onChange([]);
  const selectAll = () => onChange(permissions.map(p => p.id));
  const catSelectedCount = cat => (grouped[cat] || []).filter(p => selectedSet.has(p.id)).length;
  const searchMode = search.trim().length > 0;

  return (
    <Box>
      {/* Top bar */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search permissions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
            endAdornment: search && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}>
                  <CloseOutlined fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Button
          size="small"
          startIcon={<DoneAllOutlined />}
          onClick={selectAll}
          variant="outlined"
          sx={{ borderRadius: 2, px: 2 }}
        >
          Select All
        </Button>
        <Button
          size="small"
          startIcon={<RemoveDoneOutlined />}
          onClick={clearAll}
          variant="outlined"
          color="inherit"
          sx={{ borderRadius: 2, px: 2, color: 'text.secondary' }}
        >
          Clear
        </Button>
      </Box>

      {/* Selected summary */}
      {selected.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 2,
            borderColor: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CheckBoxOutlined fontSize="small" color="primary" />
            <Typography variant="body2" fontWeight={700} color="primary.main">
              {selected.length} permission{selected.length !== 1 ? 's' : ''} selected
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 72, overflowY: 'auto' }}>
            {selected.map(id => {
              const perm = permissions.find(p => p.id === id);
              if (!perm) return null;
              return (
                <Chip
                  key={id}
                  label={perm.name || perm.code}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={() => toggle(id)}
                  sx={{ fontSize: '0.7rem', height: 24 }}
                />
              );
            })}
          </Box>
        </Paper>
      )}

      {/* Category sidebar + permissions grid */}
      <Box
        sx={{
          display: 'flex',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          height: { xs: 400, sm: 460 },
        }}
      >
        {/* Sidebar */}
        {(!searchMode || !isMobile) && (
          <Box
            sx={{
              width: { xs: 140, sm: 190 },
              flexShrink: 0,
              borderRight: '1px solid',
              borderColor: 'divider',
              overflowY: 'auto',
              bgcolor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.02)
                  : alpha(theme.palette.common.black, 0.015),
            }}
          >
            <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.6rem' }}
              >
                Categories
              </Typography>
            </Box>
            {categories.map(cat => {
              const count = catSelectedCount(cat);
              const total = (grouped[cat] || []).length;
              const allSel = count === total && count > 0;
              const isActive = activeCategory === cat && !searchMode;
              return (
                <Box
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setSearch('');
                  }}
                  sx={{
                    px: 2,
                    py: 1.25,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    borderLeft: '3px solid',
                    borderColor: isActive ? 'primary.main' : 'transparent',
                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    '&:hover': {
                      bgcolor: isActive
                        ? alpha(theme.palette.primary.main, 0.1)
                        : alpha(theme.palette.action.hover, 0.5),
                    },
                    transition: 'all 0.15s',
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight={isActive ? 700 : 500}
                      color={isActive ? 'primary.main' : 'text.primary'}
                      noWrap
                      sx={{ fontSize: '0.8rem' }}
                    >
                      {cat}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" fontSize="0.65rem">
                      {count}/{total}
                    </Typography>
                  </Box>
                  {count > 0 && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        flexShrink: 0,
                        bgcolor: allSel ? 'primary.main' : alpha(theme.palette.primary.main, 0.5),
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {/* Permissions grid */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {!searchMode && activeCategory && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1.5,
              }}
            >
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: '0.65rem' }}
              >
                {activeCategory} · {(grouped[activeCategory] || []).length} permissions
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => toggleCategory(activeCategory)}
                sx={{ fontSize: '0.72rem', py: 0, px: 1, minWidth: 0, color: 'primary.main' }}
              >
                {catSelectedCount(activeCategory) === (grouped[activeCategory] || []).length
                  ? 'Deselect all'
                  : 'Select all'}
              </Button>
            </Box>
          )}

          {searchMode && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {visiblePerms.length} result{visiblePerms.length !== 1 ? 's' : ''} for "{search}"
            </Typography>
          )}

          {visiblePerms.length === 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '80%',
                gap: 1,
                opacity: 0.5,
              }}
            >
              <FilterListOutlined />
              <Typography variant="caption" color="text.secondary">
                No permissions found
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(175px, 1fr))' },
              gap: 1,
            }}
          >
            {visiblePerms.map(perm => {
              const isSelected = selectedSet.has(perm.id);
              return (
                <Box
                  key={perm.id}
                  onClick={() => toggle(perm.id)}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1.5px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    bgcolor: isSelected
                      ? alpha(theme.palette.primary.main, 0.07)
                      : 'background.paper',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.25,
                    '&:hover': {
                      borderColor: isSelected
                        ? 'primary.dark'
                        : alpha(theme.palette.primary.main, 0.4),
                      bgcolor: isSelected
                        ? alpha(theme.palette.primary.main, 0.1)
                        : alpha(theme.palette.primary.main, 0.03),
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 17,
                      height: 17,
                      borderRadius: 0.5,
                      border: '1.5px solid',
                      borderColor: isSelected ? 'primary.main' : 'action.disabled',
                      bgcolor: isSelected ? 'primary.main' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: '1px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isSelected && (
                      <Box
                        component="span"
                        sx={{ color: '#fff', fontSize: 11, lineHeight: 1, fontWeight: 900 }}
                      >
                        ✓
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight={isSelected ? 700 : 500}
                      color={isSelected ? 'primary.main' : 'text.primary'}
                      display="block"
                      noWrap
                      sx={{ fontSize: '0.8rem' }}
                    >
                      {perm.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ fontSize: '0.65rem', fontFamily: 'monospace' }}
                      noWrap
                      display="block"
                    >
                      {perm.code}
                    </Typography>
                    {searchMode && perm.category && (
                      <Chip
                        label={perm.category}
                        size="small"
                        sx={{ height: 16, fontSize: '0.6rem', mt: 0.5 }}
                      />
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25 }}>
        <Typography variant="caption" color="text.disabled">
          {selected.length} of {permissions.length} permissions selected
        </Typography>
      </Box>
    </Box>
  );
};

// ─────────────────────────────────────────────
// Main RoleManagement component
// ─────────────────────────────────────────────
const RoleManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const { roles, permissions, isLoading } = useSelector(state => state.roles);
  const { user: currentUser } = useSelector(state => state.auth);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [selectedRole, setSelectedRole] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [rolePermissionsMap, setRolePermissionsMap] = useState({});

  useEffect(() => {
    loadRoles();
    dispatch(fetchPermissions()).catch(() =>
      setSnackbar({ open: true, message: 'Failed to load permissions', severity: 'warning' })
    );
  }, []);

  const loadRoles = async () => {
    try {
      const result = await dispatch(fetchRoles()).unwrap();
      const map = {};
      result.forEach(role => {
        map[role.id] = role.permissions || [];
      });
      setRolePermissionsMap(map);
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  };

  const handleOpenCreateDialog = () => {
    setDialogMode('create');
    setFormData({ name: '', code: '', description: '', is_active: true });
    setSelectedPermissions([]);
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenEditDialog = role => {
    setDialogMode('edit');
    setSelectedRole(role);
    setFormData({
      name: role.name,
      code: role.code,
      description: role.description || '',
      is_active: role.is_active,
    });
    setSelectedPermissions(
      (rolePermissionsMap[role.id] || role.permissions || []).map(p => p.id)
    );
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenPermissionsDialog = async role => {
    setDialogMode('permissions');
    setSelectedRole(role);
    setLoadingPermissions(true);
    try {
      await loadRoles();
      const fresh = roles.find(r => r.id === role.id);
      setSelectedPermissions(
        (fresh?.permissions || role.permissions || []).map(p => p.id)
      );
    } catch {
      setSelectedPermissions((role.permissions || []).map(p => p.id));
    } finally {
      setLoadingPermissions(false);
      setDialogOpen(true);
    }
  };

  const handleOpenDeleteDialog = role => {
    setDialogMode('delete');
    setSelectedRole(role);
    setDialogOpen(true);
  };

  const handleFormChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(dialogMode === 'create' && name === 'name'
        ? { code: value.toLowerCase().replace(/\s+/g, '_') }
        : {}),
    }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name) errors.name = 'Role name is required';
    if (!formData.code) errors.code = 'Role code is required';
    else if (!/^[a-z_]+$/.test(formData.code))
      errors.code = 'Lowercase letters and underscores only';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (dialogMode === 'create') {
        if (!validateForm()) return;
        await dispatch(
          createRole({ ...formData, permission_ids: selectedPermissions })
        ).unwrap();
        setSnackbar({ open: true, message: 'Role created successfully', severity: 'success' });
      } else if (dialogMode === 'edit') {
        if (!validateForm()) return;
        await dispatch(updateRole({ id: selectedRole.id, ...formData })).unwrap();
        setSnackbar({ open: true, message: 'Role updated successfully', severity: 'success' });
      } else if (dialogMode === 'permissions') {
        await dispatch(
          assignPermissions({ role_id: selectedRole.id, permission_ids: selectedPermissions })
        ).unwrap();
        setSnackbar({
          open: true,
          message: 'Permissions updated successfully',
          severity: 'success',
        });
      } else if (dialogMode === 'delete') {
        await dispatch(deleteRole(selectedRole.id)).unwrap();
        setSnackbar({ open: true, message: 'Role deleted successfully', severity: 'success' });
      }
      setDialogOpen(false);
      await loadRoles();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.detail?.message || `Failed to ${dialogMode}`,
        severity: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Role Name',
        minWidth: 180,
        flex: 1,
        renderCell: params => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <ShieldOutlined
              fontSize="small"
              color={params.row.code === 'admin' ? 'error' : 'primary'}
            />
            <Typography variant="body2" fontWeight={600}>
              {params.row.name}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'code',
        headerName: 'Code',
        width: 150,
        renderCell: params => (
          <Chip
            label={params.row.code}
            size="small"
            variant="outlined"
            sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}
          />
        ),
      },
      {
        field: 'description',
        headerName: 'Description',
        minWidth: 200,
        flex: 1,
        renderCell: params => (
          <Typography variant="body2" color="text.secondary" noWrap>
            {params.row.description || '—'}
          </Typography>
        ),
      },
      {
        field: 'permissions',
        headerName: 'Permissions',
        width: 280,
        renderCell: params => {
          const perms =
            rolePermissionsMap[params.row.id] || params.row.permissions || [];
          return (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.75 }}>
              {perms.slice(0, 2).map((p, i) => (
                <Chip
                  key={p.id || i}
                  label={p.code || p.name}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: '0.68rem', height: 22 }}
                />
              ))}
              {perms.length > 2 && (
                <Chip
                  label={`+${perms.length - 2}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.68rem', height: 22 }}
                />
              )}
              {perms.length === 0 && (
                <Typography variant="caption" color="text.disabled">
                  None
                </Typography>
              )}
            </Box>
          );
        },
      },
      {
        field: 'user_count',
        headerName: 'Users',
        width: 90,
        renderCell: params => (
          <Chip
            label={params.row.user_count || 0}
            size="small"
            icon={<GroupOutlined />}
          />
        ),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 160,
        sortable: false,
        renderCell: params => (
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Tooltip title="Edit Role">
              <IconButton size="small" onClick={() => handleOpenEditDialog(params.row)}>
                <EditOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Manage Permissions">
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleOpenPermissionsDialog(params.row)}
              >
                <SecurityOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            {params.row.code !== 'admin' && params.row.code !== 'user' && (
              <Tooltip title="Delete Role">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleOpenDeleteDialog(params.row)}
                >
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ),
      },
    ],
    [rolePermissionsMap]
  );

  const stats = {
    total: roles?.length || 0,
    active: roles?.filter(r => r.is_active).length || 0,
    totalPermissions: permissions?.length || 0,
  };

  if (isLoading && (!roles || roles.length === 0)) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const isPermissionsDialog = dialogMode === 'permissions';

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 } }}>
      {/* Header */}
      <Box
        sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography
            variant={isMobile ? 'h5' : 'h4'}
            fontWeight={800}
            gutterBottom
            sx={{ letterSpacing: -0.5 }}
          >
            Role Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage system roles and their associated permissions
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton
            onClick={loadRoles}
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
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: 'repeat(3, 220px)' },
          gap: { xs: 1.5, sm: 2.5 },
          mb: 4,
        }}
      >
        {[
          { label: 'Total Roles', value: stats.total, color: 'text.primary' },
          { label: 'Active Roles', value: stats.active, color: 'success.main' },
          { label: 'Permissions', value: stats.totalPermissions, color: 'info.main' },
        ].map(({ label, value, color }) => (
          <Paper
            key={label}
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: '0.65rem' }}
            >
              {label}
            </Typography>
            <Typography
              variant="h4"
              fontWeight={800}
              color={color}
              sx={{ mt: 0.75, lineHeight: 1 }}
            >
              {value}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          All Roles
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={handleOpenCreateDialog}
          sx={{ borderRadius: 2, fontWeight: 700, px: 2.5 }}
        >
          Create Role
        </Button>
      </Paper>

      {/* DataGrid */}
      <Paper
        elevation={0}
        sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
      >
        <Box sx={{ height: 520 }}>
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
            getRowHeight={() => 'auto'}
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 700,
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                color: 'text.secondary',
              },
              '& .MuiDataGrid-cell': { borderColor: 'divider', py: 1.25 },
              '& .MuiDataGrid-footerContainer': {
                borderTop: '1px solid',
                borderColor: 'divider',
              },
            }}
          />
        </Box>
      </Paper>

      {/* Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => !isSubmitting && setDialogOpen(false)}
        maxWidth={isPermissionsDialog ? 'md' : 'sm'}
        fullWidth
        fullScreen={isMobile && isPermissionsDialog}
        PaperProps={{
          sx: {
            borderRadius: isMobile && isPermissionsDialog ? 0 : 3,
            border: isMobile && isPermissionsDialog ? 'none' : '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '1rem',
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: 3,
            py: 2.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            {dialogMode === 'permissions' && <SecurityOutlined color="primary" />}
            {dialogMode === 'create' && 'Create New Role'}
            {dialogMode === 'edit' && `Edit: ${selectedRole?.name}`}
            {dialogMode === 'permissions' && `Permissions · ${selectedRole?.name}`}
            {dialogMode === 'delete' && 'Delete Role'}
          </Box>
          <IconButton size="small" onClick={() => !isSubmitting && setDialogOpen(false)}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3, px: { xs: 2.5, sm: 3.5 }, pb: 1 }}>
          {/* Create / Edit form */}
          {(dialogMode === 'create' || dialogMode === 'edit') && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 0.5 }}>
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
                InputProps={{ sx: { fontFamily: 'monospace' } }}
              />
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                multiline
                rows={3}
                placeholder="Describe the purpose of this role…"
              />
              <Paper
                variant="outlined"
                sx={{ px: 2.5, py: 1.75, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Active Status
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Inactive roles cannot be assigned to users
                  </Typography>
                </Box>
                <Switch
                  checked={formData.is_active}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, is_active: e.target.checked }))
                  }
                  color="success"
                />
              </Paper>
            </Box>
          )}

          {/* Permissions picker */}
          {dialogMode === 'permissions' &&
            (loadingPermissions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ mt: 0.5 }}>
                <PermissionPicker
                  permissions={permissions || []}
                  selected={selectedPermissions}
                  onChange={setSelectedPermissions}
                />
              </Box>
            ))}

          {/* Delete confirmation */}
          {dialogMode === 'delete' && (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                Are you sure you want to delete <strong>{selectedRole?.name}</strong>? This
                action cannot be undone.
              </Alert>
              {selectedRole?.user_count > 0 && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  This role is assigned to <strong>{selectedRole.user_count}</strong> user(s).
                  Deleting it may affect their permissions.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: { xs: 2.5, sm: 3.5 },
            py: 2.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            gap: 1.25,
          }}
        >
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={isSubmitting}
            sx={{ borderRadius: 2, px: 2.5 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color={dialogMode === 'delete' ? 'error' : 'primary'}
            disabled={isSubmitting}
            startIcon={
              isSubmitting ? null : dialogMode === 'permissions' ? <SaveOutlined /> : null
            }
            sx={{ borderRadius: 2, minWidth: 155, px: 2.5 }}
          >
            {isSubmitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <>
                {dialogMode === 'create' && 'Create Role'}
                {dialogMode === 'edit' && 'Save Changes'}
                {dialogMode === 'permissions' && 'Save Permissions'}
                {dialogMode === 'delete' && 'Delete Role'}
              </>
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(p => ({ ...p, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ borderRadius: 2.5 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default RoleManagement;