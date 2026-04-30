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
  Snackbar
} from '@mui/material';
import {
  Save,
  Refresh,
  CheckBox,
  CheckBoxOutlineBlank,
  IndeterminateCheckBox,
  ExpandMore,
  ChevronRight
} from '@mui/icons-material';

// ✅ Correct imports for newer @mui/x-tree-view
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';

import api from '../../services/api';

const RoleMenuAssignment = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [menuTree, setMenuTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMenus, setSelectedMenus] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [expandedNodes, setExpandedNodes] = useState([]);

  // Fetch all roles
  const fetchRoles = async () => {
    try {
      const response = await api.get('/roles/');
      setRoles(response.data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      setSnackbar({ open: true, message: 'Failed to fetch roles', severity: 'error' });
    }
  };

  // Fetch menu tree for selected role
  const fetchRoleMenus = async (roleId) => {
    if (!roleId) return;

    setLoading(true);
    try {
      const response = await api.get(`/role-menu-permissions/roles/${roleId}/assignable-menus`);

      if (response.data.success) {
        const treeData = response.data.data || [];
        setMenuTree(treeData);

        // Initialize selected menus
        const selected = {};
        const traverse = (nodes) => {
          nodes.forEach((node) => {
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

        // Auto-expand parent nodes
        const expand = [];
        const collectExpanded = (nodes) => {
          nodes.forEach((node) => {
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
      console.error('Error fetching role menus:', error);
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
      setSelectedMenus((prev) => ({
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
    setSelectedMenus((prev) => ({
      ...prev,
      [menuId]: {
        ...prev[menuId],
        [permission]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedRole) {
      setSnackbar({ open: true, message: 'Please select a role', severity: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const menus = Object.keys(selectedMenus).map((menuId) => ({
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
        setSnackbar({ open: true, message: 'Menu permissions saved successfully!', severity: 'success' });
        fetchRoleMenus(selectedRole);
      } else {
        setSnackbar({ open: true, message: response.data.error || 'Failed to save', severity: 'error' });
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

  // Recursive render using TreeItem (still works inside SimpleTreeView)
  const renderTree = (nodes) => {
    if (!nodes || nodes.length === 0) return null;

    return nodes.map((node) => (
      <TreeItem
        key={node.menu_id}
        itemId={String(node.menu_id)}        // ← Important: Use itemId, not nodeId
        label={
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 0.5, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!selectedMenus[node.menu_id]}
                  onChange={(e) => handleMenuToggle(node.menu_id, e.target.checked)}
                  icon={<CheckBoxOutlineBlank />}
                  checkedIcon={<CheckBox />}
                />
              }
              label={
                <Box>
                  <Typography
                    variant="body1"
                    component="span"
                    sx={{ fontWeight: node.children?.length ? 'bold' : 'normal' }}
                  >
                    {node.title}
                  </Typography>
                  {node.code && <Chip label={node.code} size="small" sx={{ ml: 1, fontSize: '0.7rem' }} />}
                  {node.path && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {node.path}
                    </Typography>
                  )}
                </Box>
              }
            />

            {selectedMenus[node.menu_id] && (
              <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={selectedMenus[node.menu_id]?.can_view || false} onChange={(e) => handlePermissionChange(node.menu_id, 'can_view', e.target.checked)} />}
                  label="View"
                />
                <FormControlLabel
                  control={<Checkbox size="small" checked={selectedMenus[node.menu_id]?.can_access || false} onChange={(e) => handlePermissionChange(node.menu_id, 'can_access', e.target.checked)} />}
                  label="Access"
                />
                <FormControlLabel
                  control={<Checkbox size="small" checked={selectedMenus[node.menu_id]?.can_show_mb_bottom || false} onChange={(e) => handlePermissionChange(node.menu_id, 'can_show_mb_bottom', e.target.checked)} />}
                  label="Mobile"
                />
              </Stack>
            )}
          </Box>
        }
      >
        {node.children?.length > 0 && renderTree(node.children)}
      </TreeItem>
    ));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Role Menu Assignment
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Assign menu permissions to roles. Select a role to view and edit its menu access.
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Select Role</InputLabel>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                label="Select Role"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name} ({role.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => selectedRole && fetchRoleMenus(selectedRole)}
                disabled={!selectedRole || loading}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={!selectedRole || saving}
              >
                {saving ? <CircularProgress size={24} color="inherit" /> : 'Save Permissions'}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && selectedRole && menuTree.length > 0 && (
          <Card sx={{ mt: 3 }}>
            <CardHeader
              title="Menu Permissions"
              subheader={`Total root menus: ${menuTree.length} | Assigned: ${Object.keys(selectedMenus).length}`}
            />
            <Divider />
            <CardContent>
              <SimpleTreeView
                aria-label="menu tree"
                defaultCollapseIcon={<ExpandMore />}
                defaultExpandIcon={<ChevronRight />}
                expanded={expandedNodes}
                onExpandedItemsChange={(event, nodeIds) => setExpandedNodes(nodeIds)}
                sx={{ maxHeight: '650px', overflowY: 'auto' }}
              >
                {renderTree(menuTree)}
              </SimpleTreeView>
            </CardContent>
          </Card>
        )}

        {!loading && selectedRole && menuTree.length === 0 && (
          <Alert severity="info" sx={{ mt: 3 }}>
            No menus found for this role.
          </Alert>
        )}

        {!loading && !selectedRole && (
          <Alert severity="info" sx={{ mt: 3 }}>
            Please select a role to view and edit menu permissions.
          </Alert>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RoleMenuAssignment;