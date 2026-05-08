// src/components/admin/RoleMenuAssignment.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Divider,
  Snackbar,
  alpha,
  useTheme,
  Tooltip,
  IconButton,
  Container,
  Badge,
} from '@mui/material';
import {
  Save,
  Refresh,
  CheckBox,
  CheckBoxOutlineBlank,
  ExpandMore,
  ChevronRight,
  MenuOutlined,
  VisibilityOutlined,
  LockOpenOutlined,
  PhoneAndroidOutlined,
  FolderOutlined,
  PageviewOutlined,
} from '@mui/icons-material';

import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';

import api from '../../services/api';

// ── Permission checkbox pill ──────────────────
const PermPill = ({ label, icon, checked, onChange, color = 'primary' }) => {
  const theme = useTheme();
  return (
    <Box
      onClick={() => onChange(!checked)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.25,
        py: 0.5,
        borderRadius: 5,
        border: '1.5px solid',
        borderColor: checked ? `${color}.main` : 'divider',
        bgcolor: checked ? alpha(theme.palette[color].main, 0.08) : 'transparent',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.15s',
        '&:hover': {
          borderColor: `${color}.main`,
          bgcolor: alpha(theme.palette[color].main, checked ? 0.12 : 0.04),
        },
      }}
    >
      {React.cloneElement(icon, {
        sx: {
          fontSize: 13,
          color: checked ? `${color}.main` : 'text.disabled',
        },
      })}
      <Typography
        variant="caption"
        fontWeight={checked ? 700 : 500}
        color={checked ? `${color}.main` : 'text.secondary'}
        sx={{ fontSize: '0.72rem', lineHeight: 1 }}
      >
        {label}
      </Typography>
    </Box>
  );
};

const RoleMenuAssignment = () => {
  const theme = useTheme();
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [menuTree, setMenuTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMenus, setSelectedMenus] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [expandedNodes, setExpandedNodes] = useState([]);

  const fetchRoles = async () => {
    try {
      const response = await api.get('/roles/');
      setRoles(response.data || []);
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to fetch roles', severity: 'error' });
    }
  };

  const fetchRoleMenus = async roleId => {
    if (!roleId) return;
    setLoading(true);
    try {
      const response = await api.get(
        `/role-menu-permissions/roles/${roleId}/assignable-menus`
      );
      if (response.data.success) {
        const treeData = response.data.data || [];
        setMenuTree(treeData);

        const selected = {};
        const traverse = nodes => {
          nodes.forEach(node => {
            if (node.is_assigned) {
              selected[node.menu_id] = {
                can_view: node.can_view ?? true,
                can_access: node.can_access ?? true,
                can_show_mb_bottom: node.can_show_mb_bottom ?? false,
              };
            }
            if (node.children?.length) traverse(node.children);
          });
        };
        traverse(treeData);
        setSelectedMenus(selected);

        const expand = [];
        const collectExpanded = nodes => {
          nodes.forEach(node => {
            if (selected[node.menu_id] || node.children?.length > 0) {
              expand.push(String(node.menu_id));
            }
            if (node.children?.length) collectExpanded(node.children);
          });
        };
        collectExpanded(treeData);
        setExpandedNodes(expand);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to fetch menu assignments',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchRoleMenus(selectedRole);
    } else {
      setMenuTree([]);
      setSelectedMenus({});
      setExpandedNodes([]);
    }
  }, [selectedRole]);

  const handleMenuToggle = (menuId, checked) => {
    if (checked) {
      setSelectedMenus(prev => ({
        ...prev,
        [menuId]: { can_view: true, can_access: true, can_show_mb_bottom: false },
      }));
    } else {
      const newSelected = { ...selectedMenus };
      delete newSelected[menuId];
      setSelectedMenus(newSelected);
    }
  };

  const handlePermissionChange = (menuId, permission, value) => {
    setSelectedMenus(prev => ({
      ...prev,
      [menuId]: { ...prev[menuId], [permission]: value },
    }));
  };

  const handleSave = async () => {
    if (!selectedRole) {
      setSnackbar({ open: true, message: 'Please select a role', severity: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const menus = Object.keys(selectedMenus).map(menuId => ({
        menu_id: menuId,
        can_view: selectedMenus[menuId].can_view,
        can_access: selectedMenus[menuId].can_access,
        can_show_mb_bottom: selectedMenus[menuId].can_show_mb_bottom,
      }));

      const response = await api.post('/role-menu-permissions/bulk-assign', {
        role_id: selectedRole,
        menus,
      });

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: 'Menu permissions saved successfully!',
          severity: 'success',
        });
        fetchRoleMenus(selectedRole);
      } else {
        setSnackbar({
          open: true,
          message: response.data.error || 'Failed to save',
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.detail || 'Failed to save permissions',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Count assigned menus recursively
  const countAssigned = nodes => {
    let count = 0;
    const traverse = arr => {
      arr.forEach(n => {
        if (selectedMenus[n.menu_id]) count++;
        if (n.children?.length) traverse(n.children);
      });
    };
    traverse(nodes);
    return count;
  };

  const renderTree = (nodes, depth = 0) => {
    if (!nodes || nodes.length === 0) return null;

    return nodes.map(node => {
      const isAssigned = !!selectedMenus[node.menu_id];
      const hasChildren = node.children?.length > 0;

      return (
        <TreeItem
          key={node.menu_id}
          itemId={String(node.menu_id)}
          label={
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1,
                pr: 1,
                flexWrap: 'wrap',
                borderRadius: 1.5,
              }}
            >
              {/* Checkbox + label */}
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}
                onClick={e => e.stopPropagation()}
              >
                <Checkbox
                  checked={isAssigned}
                  onChange={e => handleMenuToggle(node.menu_id, e.target.checked)}
                  icon={<CheckBoxOutlineBlank sx={{ fontSize: 18 }} />}
                  checkedIcon={<CheckBox sx={{ fontSize: 18, color: 'primary.main' }} />}
                  size="small"
                  sx={{ p: 0.5 }}
                />
                {hasChildren ? (
                  <FolderOutlined
                    sx={{
                      fontSize: 16,
                      color: isAssigned ? 'warning.main' : 'text.disabled',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <PageviewOutlined
                    sx={{
                      fontSize: 16,
                      color: isAssigned ? 'primary.main' : 'text.disabled',
                      flexShrink: 0,
                    }}
                  />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="body2"
                      fontWeight={hasChildren ? 700 : isAssigned ? 600 : 400}
                      color={isAssigned ? 'text.primary' : 'text.secondary'}
                      sx={{ fontSize: depth === 0 ? '0.875rem' : '0.82rem' }}
                    >
                      {node.title}
                    </Typography>
                    {node.code && (
                      <Chip
                        label={node.code}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 18,
                          fontSize: '0.62rem',
                          fontFamily: 'monospace',
                          borderColor: 'divider',
                        }}
                      />
                    )}
                  </Box>
                  {node.path && (
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ fontSize: '0.65rem', fontFamily: 'monospace' }}
                    >
                      {node.path}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Permission pills — only visible when assigned */}
              {isAssigned && (
                <Box
                  sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', ml: 'auto' }}
                  onClick={e => e.stopPropagation()}
                >
                  <PermPill
                    label="View"
                    icon={<VisibilityOutlined />}
                    checked={selectedMenus[node.menu_id]?.can_view || false}
                    onChange={v => handlePermissionChange(node.menu_id, 'can_view', v)}
                    color="primary"
                  />
                  <PermPill
                    label="Access"
                    icon={<LockOpenOutlined />}
                    checked={selectedMenus[node.menu_id]?.can_access || false}
                    onChange={v => handlePermissionChange(node.menu_id, 'can_access', v)}
                    color="success"
                  />
                  <PermPill
                    label="Mobile"
                    icon={<PhoneAndroidOutlined />}
                    checked={selectedMenus[node.menu_id]?.can_show_mb_bottom || false}
                    onChange={v =>
                      handlePermissionChange(node.menu_id, 'can_show_mb_bottom', v)
                    }
                    color="secondary"
                  />
                </Box>
              )}
            </Box>
          }
          sx={{
            '& .MuiTreeItem-content': {
              borderRadius: 1.5,
              px: 1,
              '&:hover': {
                bgcolor: alpha(theme.palette.action.hover, 0.6),
              },
              '&.Mui-selected': {
                bgcolor: 'transparent',
                '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.6) },
              },
              '&.Mui-focused': { bgcolor: 'transparent' },
            },
            '& .MuiTreeItem-group': {
              ml: 2,
              pl: 1.5,
              borderLeft: '2px solid',
              borderColor: 'divider',
            },
          }}
        >
          {hasChildren && renderTree(node.children, depth + 1)}
        </TreeItem>
      );
    });
  };

  const selectedRole_obj = roles.find(r => r.id === selectedRole);
  const assignedCount = countAssigned(menuTree);

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 } }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom sx={{ letterSpacing: -0.5 }}>
          Menu Assignment
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Assign menu visibility and access permissions per role
        </Typography>
      </Box>

      {/* Role selector card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: 3,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={5} lg={4}>
            <FormControl fullWidth>
              <InputLabel>Select Role</InputLabel>
              <Select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                label="Select Role"
              >
                <MenuItem value="">
                  <em>— Choose a role —</em>
                </MenuItem>
                {roles.map(role => (
                  <MenuItem key={role.id} value={role.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {role.name}
                      </Typography>
                      <Chip
                        label={role.code}
                        size="small"
                        variant="outlined"
                        sx={{ fontFamily: 'monospace', fontSize: '0.65rem', height: 20 }}
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {selectedRole && (
            <Grid item xs={12} md={4} lg={5}>
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', fontSize: '0.62rem', letterSpacing: 0.6 }}>
                    Assigned Menus
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="primary.main">
                    {assignedCount}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', fontSize: '0.62rem', letterSpacing: 0.6 }}>
                    Total Menus
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {menuTree.length}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}

          <Grid item xs={12} md={3} lg={3} sx={{ ml: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1.5 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => selectedRole && fetchRoleMenus(selectedRole)}
                disabled={!selectedRole || loading}
                sx={{ borderRadius: 2 }}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={saving ? null : <Save />}
                onClick={handleSave}
                disabled={!selectedRole || saving}
                sx={{ borderRadius: 2, fontWeight: 700, minWidth: 160 }}
              >
                {saving ? <CircularProgress size={20} color="inherit" /> : 'Save Permissions'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Tree */}
      {!loading && selectedRole && menuTree.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          {/* Tree header */}
          <Box
            sx={{
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
              bgcolor: alpha(theme.palette.background.default, 0.6),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <MenuOutlined color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>
                Menu Tree
                {selectedRole_obj && (
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 1.5, fontWeight: 400 }}
                  >
                    for {selectedRole_obj.name}
                  </Typography>
                )}
              </Typography>
            </Box>

            {/* Legend */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" color="text.disabled" sx={{ mr: 0.5 }}>
                Permission types:
              </Typography>
              {[
                { label: 'View', color: 'primary', icon: <VisibilityOutlined /> },
                { label: 'Access', color: 'success', icon: <LockOpenOutlined /> },
                { label: 'Mobile', color: 'secondary', icon: <PhoneAndroidOutlined /> },
              ].map(({ label, color, icon }) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {React.cloneElement(icon, {
                    sx: { fontSize: 13, color: `${color}.main` },
                  })}
                  <Typography
                    variant="caption"
                    color={`${color}.main`}
                    fontWeight={600}
                    sx={{ fontSize: '0.68rem' }}
                  >
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Tree body */}
          <Box sx={{ p: { xs: 2, sm: 3 }, maxHeight: 680, overflowY: 'auto' }}>
            <SimpleTreeView
              aria-label="menu tree"
              slots={{ collapseIcon: ExpandMore, expandIcon: ChevronRight }}
              expandedItems={expandedNodes}
              onExpandedItemsChange={(event, nodeIds) => setExpandedNodes(nodeIds)}
              sx={{
                '& .MuiTreeItem-root': { mb: 0.25 },
              }}
            >
              {renderTree(menuTree)}
            </SimpleTreeView>
          </Box>
        </Paper>
      )}

      {/* Empty states */}
      {!loading && selectedRole && menuTree.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: 2, mt: 2 }}>
          No menus found for this role.
        </Alert>
      )}

      {!loading && !selectedRole && (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            borderRadius: 2.5,
            border: '1px dashed',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <MenuOutlined sx={{ fontSize: 40, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
            Select a Role to Get Started
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Choose a role from the dropdown above to view and edit its menu access permissions.
          </Typography>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default RoleMenuAssignment;