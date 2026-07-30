import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Container, Typography, Paper, TextField, Button, IconButton,
  Chip, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, FormControl, InputLabel, Select, MenuItem, Switch,
  FormControlLabel, Alert, Snackbar, CircularProgress, InputAdornment,
  Tooltip, Card, CardContent, Stack, Divider, useTheme, useMediaQuery,
  Collapse, Badge, alpha, Autocomplete, Fade, Checkbox, ListItemText,
  Skeleton, Tab, Tabs
} from '@mui/material';
import {
  SearchOutlined, EditOutlined, DeleteOutlined, LockOutlined,
  LockOpenOutlined, VerifiedUserOutlined, PersonAddOutlined,
  EmailOutlined, PhoneOutlined, ExpandMore, ExpandLess,
  RefreshOutlined, AdminPanelSettingsOutlined, OpenInNewOutlined,
  ShieldOutlined, PeopleAltOutlined, FilterListOutlined, CloseOutlined,
  BusinessOutlined, LinkOutlined, LinkOffOutlined, ApartmentOutlined,
  AccountTreeOutlined, SupervisorAccountOutlined, CheckCircleOutlined,
  CancelOutlined, TuneOutlined, ChevronRightOutlined, FolderOutlined,
  FolderOpenOutlined, SwapHorizOutlined, CheckBoxOutlined,
  CheckBoxOutlineBlankOutlined, WarningAmberOutlined,
  PersonOutlineOutlined, KeyOutlined, AssignmentOutlined,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import {
  fetchUsers, createUser, updateUser, deleteUser,
  resetUserPassword, updateUserRoles,
} from '../../store/slices/adminSlice';
import { fetchRoles, selectAllRoles } from '../../store/slices/roleSlice';
import api from '../../services/api';
import UserDetailPanel from './UserDetailPanel';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_PALETTE = {
  head:       { color: 'error',   label: 'Head',       bgColor: '#fef2f2', borderColor: '#fca5a5', textColor: '#b91c1c' },
  manager:    { color: 'warning', label: 'Manager',    bgColor: '#fffbeb', borderColor: '#fcd34d', textColor: '#92400e' },
  supervisor: { color: 'info',    label: 'Supervisor', bgColor: '#eff6ff', borderColor: '#93c5fd', textColor: '#1d4ed8' },
  member:     { color: 'default', label: 'Member',     bgColor: '#f9fafb', borderColor: '#d1d5db', textColor: '#374151' },
  temporary:  { color: 'warning', label: 'Temp',       bgColor: '#fffbeb', borderColor: '#fcd34d', textColor: '#92400e' },
  contractor: { color: 'default', label: 'Contractor', bgColor: '#f9fafb', borderColor: '#d1d5db', textColor: '#374151' },
};

const ASSIGNABLE_ROLES = ['member', 'supervisor', 'manager', 'head'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (u) =>
  u?.first_name?.[0]?.toUpperCase() || u?.username?.[0]?.toUpperCase() || 'U';

const fullName = (u) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.username || '—';

const buildDeptTree = (departments = []) => {
  if (!departments.length) return [];

  const map = {};
  const roots = [];

  departments.forEach((dept) => {
    map[dept.id] = {
      ...dept,
      children: [],
      level: 0,
    };
  });

  departments.forEach((dept) => {
    const node = map[dept.id];
    if (dept.parent_id && map[dept.parent_id]) {
      map[dept.parent_id].children.push(node);
      node.level = map[dept.parent_id].level + 1;
    } else if (!dept.parent_id) {
      roots.push(node);
    }
  });

  const sortChildren = (node) => {
    if (node.children?.length) {
      node.children.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };

  roots.forEach(sortChildren);
  roots.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    return a.name.localeCompare(b.name);
  });

  return roots;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const DeptPill = ({ assignment, onUnlink, compact = false }) => {
  const cfg = ROLE_PALETTE[assignment.role] || ROLE_PALETTE.member;
  return (
    <Tooltip title={`${assignment.department_name} · ${cfg.label}`} arrow>
      <Chip
        label={compact ? assignment.department_name?.split(' ')[0] : assignment.department_name}
        size="small"
        color={cfg.color}
        variant="outlined"
        onDelete={onUnlink ? () => onUnlink(assignment.department_id) : undefined}
        deleteIcon={onUnlink ? <LinkOffOutlined sx={{ fontSize: '13px !important' }} /> : undefined}
        sx={{ 
          maxWidth: 140, 
          fontSize: '0.72rem', 
          height: 22,
          '& .MuiChip-label': { px: 1 },
          '& .MuiChip-deleteIcon': { fontSize: '14px !important', mx: 0.5 }
        }}
      />
    </Tooltip>
  );
};

// ─── Improved Compact Stats ──────────────────────────────────────────────────
const ImprovedStatCard = ({ label, value, icon, color, isLoading, trend }) => {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
          transform: 'translateY(-1px)',
          boxShadow: theme.shadows[1],
        },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1.5,
          bgcolor: alpha(color || theme.palette.primary.main, 0.1),
          color: color || theme.palette.primary.main,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          '& svg': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {isLoading ? (
          <Skeleton variant="text" width={40} height={28} />
        ) : (
          <Typography variant="h6" fontWeight={700} color={color || 'text.primary'} sx={{ lineHeight: 1.2 }}>
            {value}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', fontWeight: 500, display: 'block' }}>
          {label}
        </Typography>
      </Box>
      {trend && (
        <Chip
          label={`+${trend}`}
          size="small"
          color="success"
          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
        />
      )}
    </Paper>
  );
};

// ─── Enhanced User Form with Navigation ──────────────────────────────────────
const UserForm = ({
  mode,
  formData,
  setFormData,
  passwordData,
  setPasswordData,
  formErrors,
  rolesList,
  departments,
  selectedUser,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState(0);
  const [rolesMenuOpen, setRolesMenuOpen] = useState(false);

  const getRoleDetails = (roleCode) => {
    const role = rolesList?.find((r) => r.code === roleCode);
    return {
      name: role?.name || roleCode,
      color: roleCode === 'admin' ? 'error' : 
             roleCode === 'super_admin' ? 'warning' : 
             roleCode === 'superuser' ? 'warning' : 'primary',
    };
  };

  // Auto-select admin role when superuser is checked
  const handleSuperuserToggle = (checked) => {
    setFormData((p) => {
      const newData = { ...p, is_superuser: checked };
      if (checked) {
        const adminRole = rolesList?.find((r) => r.code === 'admin');
        if (adminRole && !newData.roles.includes('admin')) {
          newData.roles = [...newData.roles, 'admin'];
        }
      } else {
        newData.roles = newData.roles.filter((r) => r !== 'admin');
      }
      return newData;
    });
  };

  const handleRoleChange = (event) => {
    const value = event.target.value;
    const selectedRoles = typeof value === 'string' ? value.split(',') : value;
    
    if (formData.is_superuser) {
      const adminRole = rolesList?.find((r) => r.code === 'admin');
      if (adminRole && !selectedRoles.includes('admin')) {
        selectedRoles.push('admin');
      }
    }
    
    setFormData((p) => ({
      ...p,
      roles: selectedRoles,
    }));
  };

  const isAdminAutoSelected = useMemo(() => {
    if (!formData.is_superuser) return false;
    const adminRole = rolesList?.find((r) => r.code === 'admin');
    return adminRole && formData.roles.includes('admin');
  }, [formData.is_superuser, formData.roles, rolesList]);

  const tabs = [
    { label: 'Personal Info', icon: <PersonOutlineOutlined /> },
    { label: 'Security', icon: <KeyOutlined /> },
    { label: 'Permissions', icon: <AssignmentOutlined /> },
  ];

  // Navigation handlers
  const handleNext = () => {
    if (activeTab < tabs.length - 1) {
      setActiveTab(activeTab + 1);
    }
  };

  const handlePrevious = () => {
    if (activeTab > 0) {
      setActiveTab(activeTab - 1);
    }
  };

  // Validate current step before proceeding
  const canProceed = () => {
    if (activeTab === 0) {
      // Personal Info validation
      if (!formData.email || !formData.username) return false;
      if (!/\S+@\S+\.\S+/.test(formData.email)) return false;
      if (formData.username.length < 3) return false;
      return true;
    }
    if (activeTab === 1 && (mode === 'create' || mode === 'reset')) {
      // Security validation
      if (!passwordData.password || passwordData.password.length < 8) return false;
      if (passwordData.password !== passwordData.confirm_password) return false;
      return true;
    }
    return true;
  };

  // Step indicators
  const StepIndicator = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
      {tabs.map((tab, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            onClick={() => setActiveTab(index)}
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              bgcolor: index === activeTab 
                ? 'primary.main' 
                : index < activeTab 
                  ? 'success.main' 
                  : (theme) => alpha(theme.palette.action.disabled, 0.2),
              color: index === activeTab || index < activeTab 
                ? 'white' 
                : 'text.disabled',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'scale(1.1)',
              },
            }}
          >
            {index < activeTab ? <CheckCircleOutlined sx={{ fontSize: 16 }} /> : index + 1}
          </Box>
          {index < tabs.length - 1 && (
            <Box
              sx={{
                width: 32,
                height: 2,
                bgcolor: index < activeTab 
                  ? 'success.main' 
                  : (theme) => alpha(theme.palette.action.disabled, 0.2),
                mx: 1,
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  );

  return (
    <Box>
      {/* Step indicator */}
      <StepIndicator />

      {/* Progress label */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Step {activeTab + 1} of {tabs.length}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {tabs[activeTab].label}
        </Typography>
      </Box>

      {/* Tabs for better organization */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant={isMobile ? 'fullWidth' : 'standard'}
        sx={{
          mb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            minHeight: 40,
            fontSize: '0.8rem',
          },
        }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.label} icon={tab.icon} label={isMobile ? null : tab.label} />
        ))}
      </Tabs>

      {/* Personal Info Tab */}
      {activeTab === 0 && (
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: formData.is_superuser ? 'warning.main' : 'primary.main',
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {formData.first_name?.[0]?.toUpperCase() || formData.username?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {mode === 'edit' ? `Editing ${selectedUser?.username}` : 'New User'}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {mode === 'edit' ? 'Update user information' : 'Create a new user account'}
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="First Name"
                name="first_name"
                size="small"
                fullWidth
                value={formData.first_name}
                onChange={(e) => setFormData((p) => ({ ...p, first_name: e.target.value }))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlineOutlined sx={{ fontSize: 18, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Last Name"
                name="last_name"
                size="small"
                fullWidth
                value={formData.last_name}
                onChange={(e) => setFormData((p) => ({ ...p, last_name: e.target.value }))}
              />
            </Grid>
          </Grid>

          <TextField
            label="Email Address"
            name="email"
            size="small"
            fullWidth
            required
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value.trim() }))}
            error={!!formErrors.email}
            helperText={formErrors.email || 'Required for login and notifications'}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlined sx={{ fontSize: 18, color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Username"
            name="username"
            size="small"
            fullWidth
            required
            value={formData.username}
            onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value.trim() }))}
            error={!!formErrors.username}
            helperText={formErrors.username || 'Unique identifier for login'}
          />

          <TextField
            label="Phone Number"
            name="phone"
            size="small"
            fullWidth
            value={formData.phone}
            onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneOutlined sx={{ fontSize: 18, color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
        </Stack>
      )}

      {/* Security Tab */}
      {activeTab === 1 && (
        <Stack spacing={2.5}>
          {mode === 'create' ? (
            <>
              <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                Set a strong password for the new user account.
              </Alert>
              <TextField
                label="Password"
                name="password"
                type="password"
                size="small"
                fullWidth
                required
                value={passwordData.password}
                onChange={(e) => setPasswordData((p) => ({ ...p, password: e.target.value }))}
                error={!!formErrors.password}
                helperText={formErrors.password || 'At least 8 characters with mix of letters and numbers'}
              />
              <TextField
                label="Confirm Password"
                name="confirm_password"
                type="password"
                size="small"
                fullWidth
                required
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData((p) => ({ ...p, confirm_password: e.target.value }))}
                error={!!formErrors.confirm_password}
                helperText={formErrors.confirm_password}
              />
            </>
          ) : mode === 'reset' ? (
            <>
              <Alert severity="warning" sx={{ borderRadius: 1.5 }}>
                This will reset the password for <strong>{selectedUser?.username}</strong>
              </Alert>
              <TextField
                label="New Password"
                name="password"
                type="password"
                size="small"
                fullWidth
                value={passwordData.password}
                onChange={(e) => setPasswordData((p) => ({ ...p, password: e.target.value }))}
                error={!!formErrors.password}
                helperText={formErrors.password || 'At least 8 characters'}
              />
              <TextField
                label="Confirm New Password"
                name="confirm_password"
                type="password"
                size="small"
                fullWidth
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData((p) => ({ ...p, confirm_password: e.target.value }))}
                error={!!formErrors.confirm_password}
                helperText={formErrors.confirm_password}
              />
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <LockOutlined sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Password cannot be changed in edit mode.
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Use the "Reset Password" action to change user password.
              </Typography>
            </Box>
          )}
        </Stack>
      )}

      {/* Permissions Tab */}
      {activeTab === 2 && (
        <Stack spacing={3}>
          {/* Account Status */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.background.default, 0.5),
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
              Account Status
            </Typography>
            <Stack spacing={1.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Active Account
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Inactive users cannot log in
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_verified}
                    onChange={(e) => setFormData((p) => ({ ...p, is_verified: e.target.checked }))}
                    color="info"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Verified Email
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Verified users have confirmed their email
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_superuser}
                    onChange={(e) => handleSuperuserToggle(e.target.checked)}
                    color="warning"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Super Admin
                      {formData.is_superuser && (
                        <Chip
                          label="Auto-assigns admin role"
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ ml: 1, height: 20, fontSize: '0.6rem' }}
                        />
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Full system access with all permissions
                    </Typography>
                  </Box>
                }
              />
            </Stack>
          </Paper>

          {/* Role Assignment */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.background.default, 0.5),
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
              Role Assignment
            </Typography>
            
            {isAdminAutoSelected && (
              <Alert severity="info" sx={{ mb: 2, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                Admin role is automatically assigned for Super Admin users and cannot be removed
              </Alert>
            )}
            
            <FormControl size="small" fullWidth>
              <Select
                multiple
                open={rolesMenuOpen}
                onOpen={() => setRolesMenuOpen(true)}
                onClose={() => setRolesMenuOpen(false)}
                value={formData.roles}
                onChange={handleRoleChange}
                renderValue={(sel) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {sel.length === 0 ? (
                      <Typography variant="body2" color="text.disabled">
                        No roles assigned
                      </Typography>
                    ) : (
                      sel.map((v) => (
                        <Chip
                          key={v}
                          label={getRoleDetails(v).name}
                          size="small"
                          color={getRoleDetails(v).color}
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      ))
                    )}
                  </Box>
                )}
              >
                {(rolesList || []).map((r) => {
                  const isAdmin = r.code === 'admin';
                  const isDisabled = formData.is_superuser && isAdmin;
                  
                  return (
                    <MenuItem 
                      key={r.id} 
                      value={r.code}
                      disabled={isDisabled}
                      sx={{
                        opacity: isDisabled ? 0.7 : 1,
                        '&.Mui-disabled': {
                          opacity: 0.7,
                        },
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={formData.roles.includes(r.code)}
                        sx={{ mr: 0.5, p: 0.5 }}
                        disabled={isDisabled}
                      />
                      <ListItemText
                        primary={r.name}
                        secondary={r.description}
                        primaryTypographyProps={{ fontSize: '0.9rem' }}
                        secondaryTypographyProps={{ fontSize: '0.75rem' }}
                      />
                      {isDisabled && (
                        <Chip
                          label="Auto-assigned"
                          size="small"
                          color="info"
                          sx={{ ml: 1, height: 20, fontSize: '0.6rem' }}
                        />
                      )}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Paper>

          {/* Department Assignment */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.background.default, 0.5),
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
              Department Access
            </Typography>
            <Autocomplete
              multiple
              options={departments}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={departments.filter((d) => formData.department_ids.includes(d.id))}
              onChange={(_, v) => setFormData((p) => ({ ...p, department_ids: v.map((d) => d.id) }))}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Departments"
                  size="small"
                  placeholder="Search departments..."
                  helperText="Users can only access assigned departments"
                />
              )}
              renderTags={(val, getTagProps) =>
                val.map((opt, i) => (
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
            />
          </Paper>
        </Stack>
      )}

      {/* Navigation Buttons */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 4,
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: 2,
        }}
      >
        <Button
          variant="outlined"
          onClick={handlePrevious}
          disabled={activeTab === 0}
          startIcon={<ChevronRightOutlined sx={{ transform: 'rotate(180deg)' }} />}
          sx={{ borderRadius: 1.5 }}
        >
          Previous
        </Button>

        {activeTab < tabs.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!canProceed()}
            endIcon={<ChevronRightOutlined />}
            sx={{ borderRadius: 1.5 }}
          >
            Next Step
          </Button>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleOutlined color="success" />
            <Typography variant="body2" color="success.main" fontWeight={600}>
              Ready to create
            </Typography>
          </Box>
        )}
      </Box>

      {/* Show validation hints */}
      {activeTab === 0 && !canProceed() && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
          Please fill in all required fields: Email and Username
        </Typography>
      )}
      {activeTab === 1 && (mode === 'create' || mode === 'reset') && !canProceed() && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
          Please set a valid password (min 8 characters, matching confirmation)
        </Typography>
      )}
    </Box>
  );
};

// ─── Dept Tree Node ──────────────────────────────────────────────────────────
const DeptTreeNode = ({
  node,
  level = 0,
  selectedMap,
  onToggleChild,
  onRoleChange,
  searchTerm = '',
  defaultOpen = false
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = !!selectedMap[node.id];
  const selectedChildrenCount = node.children?.filter(c => selectedMap[c.id]).length || 0;

  useEffect(() => {
    if (selectedChildrenCount > 0 || (searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase()))) {
      setOpen(true);
    }
  }, [selectedChildrenCount, searchTerm, node.name]);

  const matchesSearch = !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase());
  const hasMatchingChildren = node.children?.some(child =>
    child.name.toLowerCase().includes(searchTerm?.toLowerCase() || '')
  );

  if (searchTerm && !matchesSearch && !hasMatchingChildren) {
    return null;
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {level > 0 && (
        <>
          <Box
            sx={{
              position: 'absolute',
              left: level * 16 - 8,
              top: 0,
              bottom: '50%',
              width: '1px',
              bgcolor: 'divider',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: level * 16 - 8,
              top: '50%',
              width: 10,
              height: '1px',
              bgcolor: 'divider',
            }}
          />
        </>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          ml: level * 2,
          borderRadius: 1.5,
          cursor: 'pointer',
          transition: 'all 0.13s',
          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
          '&:hover': {
            bgcolor: isSelected
              ? alpha(theme.palette.primary.main, 0.09)
              : alpha(theme.palette.action.hover, 0.6),
          },
        }}
        onClick={() => {
          if (hasChildren) {
            setOpen(v => !v);
          } else {
            onToggleChild(node.id);
          }
        }}
      >
        <Box sx={{ color: 'text.disabled', display: 'flex', flexShrink: 0, width: 20 }}>
          {hasChildren ? (
            <ChevronRightOutlined
              sx={{
                fontSize: 18,
                transition: 'transform 0.18s',
                transform: open ? 'rotate(90deg)' : 'none',
              }}
            />
          ) : (
            <Box sx={{ width: 18 }} />
          )}
        </Box>

        <Box
          sx={{
            color: isSelected ? 'primary.main' : 'text.disabled',
            display: 'flex',
            flexShrink: 0
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleChild(node.id);
          }}
        >
          {isSelected
            ? <CheckBoxOutlined sx={{ fontSize: 18 }} />
            : <CheckBoxOutlineBlankOutlined sx={{ fontSize: 18 }} />}
        </Box>

        <Box sx={{ color: open ? 'primary.main' : 'text.secondary', display: 'flex', flexShrink: 0 }}>
          {hasChildren ? (
            open ? <FolderOpenOutlined sx={{ fontSize: 18 }} /> : <FolderOutlined sx={{ fontSize: 18 }} />
          ) : (
            <ApartmentOutlined sx={{ fontSize: 16 }} />
          )}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={isSelected ? 600 : 400}
            color={isSelected ? 'primary.main' : 'text.primary'}
            noWrap
            sx={{ fontSize: '0.82rem' }}
          >
            {node.name}
          </Typography>
          {node.description && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
              {node.description}
            </Typography>
          )}
        </Box>

        {node.member_count != null && node.member_count > 0 && (
          <Chip
            label={`${node.member_count}`}
            size="small"
            variant="outlined"
            sx={{ height: 18, fontSize: '0.65rem' }}
          />
        )}

        {hasChildren && selectedChildrenCount > 0 && (
          <Chip
            label={`${selectedChildrenCount} selected`}
            size="small"
            color="primary"
            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
          />
        )}

        {isSelected && !hasChildren && (
          <Box onClick={(e) => e.stopPropagation()}>
            <RoleChip
              role={selectedMap[node.id] || 'member'}
              onChange={(r) => onRoleChange(node.id, r)}
            />
          </Box>
        )}
      </Box>

      {hasChildren && (
        <Collapse in={open}>
          <Box sx={{ pl: 0.5 }}>
            {node.children.map((child) => (
              <DeptTreeNode
                key={child.id}
                node={child}
                level={level + 1}
                selectedMap={selectedMap}
                onToggleChild={onToggleChild}
                onRoleChange={onRoleChange}
                searchTerm={searchTerm}
                defaultOpen={defaultOpen}
              />
            ))}
          </Box>
        </Collapse>
      )}

      {level === 0 && <Divider sx={{ mt: 0.5, opacity: 0.5 }} />}
    </Box>
  );
};

const DiffRow = ({ icon, color, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    <Box sx={{ color, display: 'flex', flexShrink: 0 }}>{icon}</Box>
    <Typography variant="caption" color={color} sx={{ fontSize: '0.75rem' }}>
      {children}
    </Typography>
  </Box>
);

const RoleChip = ({ role, onChange, disabled }) => {
  const cfg = ROLE_PALETTE[role] || ROLE_PALETTE.member;
  return (
    <FormControl size="small" sx={{ minWidth: 110 }} disabled={disabled}>
      <Select
        value={role}
        onChange={(e) => onChange(e.target.value)}
        variant="outlined"
        sx={{
          height: 26,
          fontSize: '0.72rem',
          fontWeight: 600,
          color: cfg.textColor,
          bgcolor: cfg.bgColor,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: cfg.borderColor,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: cfg.textColor,
          },
          '& .MuiSelect-icon': { color: cfg.textColor, fontSize: 16 },
          borderRadius: 1,
        }}
        MenuProps={{ 
          PaperProps: { 
            sx: { mt: 0.5, borderRadius: 1.5, maxHeight: 200 } 
          } 
        }}
      >
        {ASSIGNABLE_ROLES.map((r) => {
          const c = ROLE_PALETTE[r];
          return (
            <MenuItem key={r} value={r} sx={{ fontSize: '0.78rem', fontWeight: 600 }}>
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: 8, height: 8, borderRadius: '50%',
                  bgcolor: c.textColor, mr: 1, flexShrink: 0,
                }}
              />
              {c.label}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
};

// ─── Department Dialog ──────────────────────────────────────────────────────
const DepartmentDialog = ({
  open, onClose, user, departments, currentAssignments, onSave, saving,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [selectedMap, setSelectedMap] = useState({});
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);

  const activeDepartments = useMemo(() => {
    return departments.filter(dept => dept.is_active !== false);
  }, [departments]);

  const deptTree = useMemo(() => buildDeptTree(activeDepartments), [activeDepartments]);

  const deptNameMap = useMemo(() => {
    const map = {};
    const buildMap = (nodes) => {
      nodes.forEach(node => {
        map[node.id] = node.name;
        if (node.children?.length) {
          buildMap(node.children);
        }
      });
    };
    buildMap(deptTree);
    return map;
  }, [deptTree]);

  useEffect(() => {
    if (open) {
      const initial = {};
      currentAssignments.forEach((a) => {
        initial[a.department_id] = a.role || 'member';
      });
      setSelectedMap(initial);
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 120);
    }
  }, [open, currentAssignments]);

  const filteredTree = useMemo(() => {
    if (!search.trim()) return deptTree;
    const q = search.toLowerCase();

    const filterNode = (node) => {
      const matchesName = node.name.toLowerCase().includes(q);
      const filteredChildren = node.children.filter(filterNode);

      if (matchesName || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren
        };
      }
      return null;
    };

    return deptTree.map(filterNode).filter(Boolean);
  }, [deptTree, search]);

  const handleToggleChild = useCallback((deptId) => {
    setSelectedMap((prev) => {
      if (prev[deptId]) {
        const next = { ...prev };
        delete next[deptId];
        return next;
      }
      return { ...prev, [deptId]: 'member' };
    });
  }, []);

  const handleRoleChange = useCallback((deptId, role) => {
    setSelectedMap((prev) => ({ ...prev, [deptId]: role }));
  }, []);

  const { toAdd, toRemove, toChange } = useMemo(() => {
    const prevMap = {};
    currentAssignments.forEach((a) => {
      prevMap[a.department_id] = a.role || 'member';
    });

    const toAdd = Object.keys(selectedMap).filter((id) => !prevMap[id]);
    const toRemove = Object.keys(prevMap).filter((id) => !selectedMap[id]);
    const toChange = Object.keys(selectedMap).filter(
      (id) => prevMap[id] && prevMap[id] !== selectedMap[id],
    );

    return { toAdd, toRemove, toChange };
  }, [selectedMap, currentAssignments]);

  const hasChanges = toAdd.length + toRemove.length + toChange.length > 0;
  const selectedCount = Object.keys(selectedMap).length;

  const getDeptName = (id) => deptNameMap[id] || id;

  const handleSave = () => {
    const removeIds = toRemove;
    const addEntries = toAdd.map((id) => ({ id, role: selectedMap[id] }));
    const changeEntries = toChange.map((id) => ({ id, role: selectedMap[id] }));
    onSave({ addEntries, changeEntries, removeIds, selectedMap });
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      TransitionComponent={Fade}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2.5,
          overflow: 'hidden',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: (t) => alpha(t.palette.primary.main, 0.03),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: 1.5,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AccountTreeOutlined color="primary" />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} noWrap>Department access</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {fullName(user)} · @{user?.username}
            </Typography>
          </Box>

          <Chip
            icon={<ApartmentOutlined sx={{ fontSize: '14px !important' }} />}
            label={`${selectedCount} assigned`}
            size="small"
            color={selectedCount > 0 ? 'primary' : 'default'}
            variant="outlined"
            sx={{ fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}
          />

          {isMobile && (
            <IconButton size="small" onClick={onClose} disabled={saving}>
              <CloseOutlined fontSize="small" />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <TextField
            inputRef={searchRef}
            fullWidth
            size="small"
            placeholder="Search active departments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')}>
                    <CloseOutlined sx={{ fontSize: 14 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />
        </Box>

        <Box
          sx={{
            px: 2.5, pb: 1.5,
            display: 'flex', alignItems: 'center', gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            Roles:
          </Typography>
          {ASSIGNABLE_ROLES.map((r) => {
            const cfg = ROLE_PALETTE[r];
            return (
              <Box
                key={r}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 0.75, py: 0.25, borderRadius: 0.75,
                  bgcolor: cfg.bgColor,
                  border: `1px solid ${cfg.borderColor}`,
                }}
              >
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.textColor }} />
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: cfg.textColor }}>
                  {cfg.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {activeDepartments.length !== departments.length && (
          <Box sx={{ px: 2.5, pb: 1.5 }}>
            <Alert severity="info" icon={<BusinessOutlined />} sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
              Showing only active departments ({activeDepartments.length} of {departments.length})
            </Alert>
          </Box>
        )}

        <Divider />

        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 1.5,
            py: 1,
            minHeight: 260,
            maxHeight: isMobile ? 'calc(100vh - 480px)' : 340,
            '&::-webkit-scrollbar': {
              width: 4,
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'divider',
              borderRadius: 4,
            },
          }}
        >
          {filteredTree.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography color="text.disabled" variant="body2">
                {search ? 'No matching departments found' : 'No active departments available'}
              </Typography>
            </Box>
          ) : (
            filteredTree.map((node) => (
              <DeptTreeNode
                key={node.id}
                node={node}
                level={0}
                selectedMap={selectedMap}
                onToggleChild={handleToggleChild}
                onRoleChange={handleRoleChange}
                searchTerm={search}
                defaultOpen={!!search || node.children?.some(c => selectedMap[c.id])}
              />
            ))
          )}
        </Box>

        <Divider />

        {hasChanges && (
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              bgcolor: (t) => alpha(t.palette.background.default, 0.5),
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem', mb: 0.75, display: 'block' }}
            >
              Pending changes ({toAdd.length + toRemove.length + toChange.length})
            </Typography>
            <Stack spacing={0.5}>
              {toAdd.map((id) => (
                <DiffRow
                  key={id}
                  icon={<CheckCircleOutlined sx={{ fontSize: 14 }} />}
                  color="success.main"
                >
                  Add: <strong>{getDeptName(id)}</strong> as {ROLE_PALETTE[selectedMap[id]]?.label}
                </DiffRow>
              ))}
              {toRemove.map((id) => (
                <DiffRow
                  key={id}
                  icon={<CancelOutlined sx={{ fontSize: 14 }} />}
                  color="error.main"
                >
                  Remove: <strong>{getDeptName(id)}</strong>
                </DiffRow>
              ))}
              {toChange.map((id) => (
                <DiffRow
                  key={id}
                  icon={<SwapHorizOutlined sx={{ fontSize: 14 }} />}
                  color="warning.main"
                >
                  <strong>{getDeptName(id)}</strong>: role → {ROLE_PALETTE[selectedMap[id]]?.label}
                </DiffRow>
              ))}
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5, py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          gap: 1,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.9),
        }}
      >
        <Button onClick={onClose} disabled={saving} sx={{ borderRadius: 1.5 }}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {selectedCount} department{selectedCount !== 1 ? 's' : ''} selected
        </Typography>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || !hasChanges}
          startIcon={
            saving
              ? <CircularProgress size={16} color="inherit" />
              : <LinkOutlined />
          }
          sx={{ minWidth: 150, borderRadius: 1.5, fontWeight: 700 }}
        >
          {saving
            ? 'Saving…'
            : hasChanges
              ? `Save ${toAdd.length + toRemove.length + toChange.length} change${toAdd.length + toRemove.length + toChange.length !== 1 ? 's' : ''}`
              : 'No changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const UserManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const { users, isLoading, total } = useSelector((s) => s.admin);
  const { user: currentUser } = useSelector((s) => s.auth);
  const rolesList = useSelector(selectAllRoles);

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

  const [rolesMenuOpen, setRolesMenuOpen] = useState(false);

  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [deptDialogUser, setDeptDialogUser] = useState(null);
  const [savingDepts, setSavingDepts] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [userDepartmentsMap, setUserDeptMap] = useState({});
  const [loadingUserDepts, setLoadingUserDepts] = useState({});

  const [formData, setFormData] = useState({
    email: '', username: '', first_name: '', last_name: '', phone: '',
    roles: [], is_active: true, is_verified: false, is_superuser: false,
    department_ids: [],
  });
  const [passwordData, setPasswordData] = useState({ password: '', confirm_password: '' });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchDepartments = useCallback(async () => {
    try {
      const r = await api.get('/departments');
      setDepartments(r.data || []);
    } catch {
      setDepartments([]);
    }
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

  useEffect(() => { 
    dispatch(fetchRoles()); 
    fetchDepartments(); 
  }, [dispatch]);

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
      users.forEach((u) => { 
        if (!userDepartmentsMap[u.id]) fetchUserDepts(u.id); 
      });
    }
  }, [users]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setUserDeptMap({});
    await Promise.all([
      loadUsers(),
      dispatch(fetchRoles()),
      fetchDepartments()
    ]);
    setIsRefreshing(false);
    setSnackbar({ open: true, message: 'Data refreshed', severity: 'success' });
  };

  // ── Enhanced department save handler ─────────────────────────────────────────
  const handleSaveDepartments = async ({ addEntries, changeEntries, removeIds }) => {
    if (!deptDialogUser) return;
    setSavingDepts(true);
    try {
      for (const { id, role } of addEntries) {
        await api.post(`/users/${deptDialogUser.id}/departments`, {
          department_ids: [id],
          role,
        });
      }

      for (const { id, role } of changeEntries) {
        await api.patch(`/users/${deptDialogUser.id}/departments/${id}`, { role });
      }

      for (const deptId of removeIds) {
        await api.delete(`/users/${deptDialogUser.id}/departments/${deptId}`);
      }

      await fetchUserDepts(deptDialogUser.id, true);

      const total = addEntries.length + changeEntries.length + removeIds.length;
      setSnackbar({
        open: true,
        message: `Department access updated (${total} change${total !== 1 ? 's' : ''})`,
        severity: 'success',
      });
      setDeptDialogOpen(false);
    } catch (e) {
      setSnackbar({
        open: true,
        message: e.response?.data?.detail || 'Failed to update departments',
        severity: 'error',
      });
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
      color: roleCode === 'admin' ? 'error' : 
             roleCode === 'super_admin' ? 'warning' : 
             roleCode === 'superuser' ? 'warning' : 'primary',
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
              <AccountTreeOutlined fontSize="small" />
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
    
    let roles = [...(user.roles || [])];
    
    if (user.is_superuser) {
      const adminRole = rolesList?.find((r) => r.code === 'admin');
      if (adminRole && !roles.includes('admin')) {
        roles.push('admin');
      }
    }
    
    setFormData({
      email: user.email,
      username: user.username,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      roles: roles,
      is_active: user.is_active,
      is_verified: user.is_verified,
      is_superuser: user.is_superuser || false,
      department_ids: assignments.map((a) => a.department_id),
    });
    setPasswordData({ password: '', confirm_password: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenDelete = (user) => {
    setDialogMode('delete');
    setSelectedUser(user);
    setPasswordData({ password: '', confirm_password: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleOpenReset = (user) => {
    setDialogMode('reset'); 
    setSelectedUser(user);
    setPasswordData({ password: '', confirm_password: '' });
    setFormErrors({});
    setDialogOpen(true);
  };
  
  const handleOpenCreate = () => {
    setDialogMode('create');
    setSelectedUser(null);
    setFormData({
      email: '', username: '', first_name: '', last_name: '', phone: '',
      roles: [],
      is_active: true,
      is_verified: false,
      is_superuser: false,
      department_ids: [],
    });
    setPasswordData({ password: '', confirm_password: '' });
    setFormErrors({});
    setDialogOpen(true);
  };

  // ── Form validation / submit ─────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (dialogMode === 'create' || dialogMode === 'edit') {
      if (!formData.email) e.email = 'Required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Invalid email';
      if (!formData.username || formData.username.length < 3) e.username = 'Min 3 chars';
    }
    if (dialogMode === 'create' || dialogMode === 'reset') {
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
        const submitData = { ...formData };
        if (submitData.is_superuser) {
          const adminRole = rolesList?.find((r) => r.code === 'admin');
          if (adminRole && !submitData.roles.includes('admin')) {
            submitData.roles = [...submitData.roles, 'admin'];
          }
        }
        
        const created = await dispatch(createUser({ 
          ...submitData, 
          password: passwordData.password 
        })).unwrap();

        if (formData.department_ids?.length && created?.id) {
          await api.post(`/users/${created.id}/departments`, {
            department_ids: formData.department_ids,
            role: 'member',
          });
          await fetchUserDepts(created.id, true);
        }

        setSnackbar({ open: true, message: 'User created successfully', severity: 'success' });
      } else if (dialogMode === 'edit') {
        let roles = [...(formData.roles || [])];
        if (formData.is_superuser) {
          const adminRole = rolesList?.find((r) => r.code === 'admin');
          if (adminRole && !roles.includes('admin')) {
            roles = [...roles, 'admin'];
          }
        } else {
          roles = roles.filter((r) => r !== 'admin');
        }
        
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

        const prevRoles = [...(selectedUser.roles || [])].sort();
        const nextRoles = [...roles].sort();
        if (JSON.stringify(prevRoles) !== JSON.stringify(nextRoles)) {
          await dispatch(updateUserRoles({ id: selectedUser.id, roles: nextRoles })).unwrap();
        }

        const prevDepts = (userDepartmentsMap[selectedUser.id] || []).map((a) => a.department_id).sort();
        const nextDepts = [...(formData.department_ids || [])].sort();
        if (JSON.stringify(prevDepts) !== JSON.stringify(nextDepts)) {
          const toAdd = nextDepts.filter((id) => !prevDepts.includes(id));
          const toRm = prevDepts.filter((id) => !nextDepts.includes(id));
          if (toAdd.length) {
            await api.post(`/users/${selectedUser.id}/departments`, { department_ids: toAdd, role: 'member' });
          }
          for (const dId of toRm) {
            await api.delete(`/users/${selectedUser.id}/departments/${dId}`);
          }
          await fetchUserDepts(selectedUser.id, true);
        }
        setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' });
      } else if (dialogMode === 'delete') {
        await dispatch(deleteUser(selectedUser.id)).unwrap();
        if (detailUser?.id === selectedUser.id) setDetailUser(null);
        setSnackbar({ open: true, message: 'User deleted successfully', severity: 'success' });
      } else if (dialogMode === 'reset') {
        await dispatch(resetUserPassword({ 
          user_id: selectedUser.id, 
          new_password: passwordData.password 
        })).unwrap();
        setSnackbar({ open: true, message: 'Password reset successfully', severity: 'success' });
      }
      setDialogOpen(false);
      loadUsers();
    } catch (err) {
      setSnackbar({ 
        open: true, 
        message: err.message || `${dialogMode} failed`, 
        severity: 'error' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: total || 0,
    active: users?.filter((u) => u.is_active).length || 0,
    verified: users?.filter((u) => u.is_verified).length || 0,
    admins: users?.filter((u) => u.roles?.includes('admin')).length || 0,
    superadmins: users?.filter((u) => u.is_superuser).length || 0,
  }), [users, total]);

  const STAT_CARDS = [
    { label: 'Total Users', value: stats.total, icon: <PeopleAltOutlined />, color: theme.palette.primary.main },
    { label: 'Active', value: stats.active, icon: <LockOpenOutlined />, color: theme.palette.success.main },
    { label: 'Verified', value: stats.verified, icon: <VerifiedUserOutlined />, color: theme.palette.info.main },
    { label: 'Admins', value: stats.admins, icon: <AdminPanelSettingsOutlined />, color: theme.palette.warning.main },
    { label: 'Super Admins', value: stats.superadmins, icon: <ShieldOutlined />, color: theme.palette.error.main },
  ];

  // ── Mobile card ──────────────────────────────────────────────────────────────
  const UserCard = ({ user }) => {
    const expanded = expandedUser === user.id;
    const selected = detailUser?.id === user.id;
    const assignments = userDepartmentsMap[user.id] || [];
    const isLoadingD = loadingUserDepts[user.id];

    return (
      <Card
        sx={{
          mb: 1.5, 
          borderRadius: 2.5, 
          border: '1.5px solid',
          borderColor: selected ? 'primary.main' : user.is_superuser
            ? (t) => alpha(t.palette.warning.main, 0.4) : 'divider',
          transition: 'all 0.18s ease',
          '&:hover': {
            borderColor: 'primary.main',
          }
        }}
      >
        <CardContent sx={{ pb: '8px !important', px: 2, pt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Avatar sx={{ 
                bgcolor: user.is_superuser ? 'warning.main' : 'primary.main', 
                width: 42, height: 42, fontWeight: 700 
              }}>
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
                  <AccountTreeOutlined fontSize="small" />
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
              <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                No departments
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip
              label={user.is_active ? 'Active' : 'Inactive'}
              size="small"
              color={user.is_active ? 'success' : 'default'}
              icon={user.is_active ? <LockOpenOutlined /> : <LockOutlined />}
            />
            {user.is_verified && (
              <Chip label="Verified" size="small" color="info" variant="outlined" />
            )}
            {(user.roles || []).slice(0, 2).map((c) => {
              const { name, color } = getRoleDetails(c);
              return (
                <Chip key={c} label={name} size="small" color={color} variant="outlined" sx={{ fontWeight: 600 }} />
              );
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
              onClick={() => handleOpenEdit(user)} sx={{ flex: 1, minWidth: 80 }}>
              Edit
            </Button>
            <Button size="small" variant="outlined" startIcon={<LockOutlined />}
              onClick={() => handleOpenReset(user)} sx={{ flex: 1, minWidth: 80 }}>
              Reset PW
            </Button>
            {user.id !== currentUser?.id && !user.is_superuser && (
              <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlined />}
                onClick={() => handleOpenDelete(user)} sx={{ flex: 1, minWidth: 80 }}>
                Delete
              </Button>
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
              onClick={handleRefresh}
              disabled={isRefreshing}
              sx={{ 
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                '&:disabled': { opacity: 0.6 }
              }}
            >
              {isRefreshing ? <CircularProgress size={24} /> : <RefreshOutlined />}
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

      {/* Improved Stats - Compact Layout */}
      <Box sx={{ mb: 3 }}>
        {isMobile ? (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              overflowX: 'auto',
              pb: 1,
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
              mx: -0.5,
              px: 0.5,
            }}
          >
            {STAT_CARDS.map((s) => (
              <ImprovedStatCard key={s.label} {...s} isLoading={isLoading} />
            ))}
          </Box>
        ) : (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 1.5,
          }}>
            {STAT_CARDS.map((s) => (
              <ImprovedStatCard key={s.label} {...s} isLoading={isLoading} />
            ))}
          </Box>
        )}
      </Box>

      {/* Search + filters */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            placeholder="Search users by name, email, or username…"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <CloseOutlined fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <Tooltip title={showFilters ? 'Hide filters' : 'Show filters'}>
            <IconButton
              size="small"
              onClick={() => setShowFilters((v) => !v)}
              sx={{
                border: '1px solid', 
                borderRadius: 1.5, 
                px: 1.5,
                borderColor: showFilters ? 'primary.main' : 'divider',
                color: showFilters ? 'primary.main' : 'text.secondary',
                bgcolor: showFilters ? (t) => alpha(t.palette.primary.main, 0.06) : 'transparent',
                transition: 'all 0.2s',
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
                  <Select 
                    value={value} 
                    onChange={(e) => { set(e.target.value); setPage(0); }} 
                    label={label}
                  >
                    {opts.map(([v, l]) => (
                      <MenuItem key={v} value={v}>{l}</MenuItem>
                    ))}
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
                  '& .MuiDataGrid-row': { 
                    cursor: 'pointer', 
                    '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) } 
                  },
                  '& .MuiDataGrid-cell': { borderColor: 'divider', py: 1, alignItems: 'center' },
                  '& .MuiDataGrid-footerContainer': {
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }
                }}
              />
            </Paper>
          )}

          {/* Mobile cards */}
          {isMobile && (
            <Box>
              {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              )}
              {!isLoading && !users?.length && (
                <Paper elevation={0} sx={{ 
                  p: 4, 
                  textAlign: 'center', 
                  borderRadius: 2, 
                  border: '1px solid', 
                  borderColor: 'divider' 
                }}>
                  <Typography color="text.secondary">No users found</Typography>
                  {searchTerm && (
                    <Button 
                      size="small" 
                      sx={{ mt: 1 }}
                      onClick={() => setSearchTerm('')}
                    >
                      Clear search
                    </Button>
                  )}
                </Paper>
              )}
              {!isLoading && users?.map((u) => <UserCard key={u.id} user={u} />)}
              {!isLoading && users?.length > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 1.5, alignItems: 'center' }}>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => setPage((p) => p - 1)} 
                    disabled={page === 0}
                  >
                    Prev
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    {page + 1} / {Math.ceil(total / rowsPerPage)}
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => setPage((p) => p + 1)} 
                    disabled={(page + 1) * rowsPerPage >= total}
                  >
                    Next
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Side detail panel */}
        {detailUser && (
          <Box sx={{
            width: { xs: '100%', md: 370 }, 
            flexShrink: 0,
            position: isMobile ? 'fixed' : 'sticky', 
            top: isMobile ? 0 : 16,
            zIndex: isMobile ? 1200 : 1,
            maxHeight: isMobile ? '100vh' : 'calc(100vh - 32px)',
            overflowY: 'auto',
          }}>
            {isMobile && (
              <Box 
                onClick={() => setDetailUser(null)}
                sx={{ 
                  position: 'fixed', 
                  inset: 0, 
                  bgcolor: (t) => alpha(t.palette.common.black, 0.5), 
                  zIndex: -1 
                }} 
              />
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

      {/* ── Enhanced Department Hierarchy Dialog ── */}
      <DepartmentDialog
        open={deptDialogOpen}
        onClose={() => setDeptDialogOpen(false)}
        user={deptDialogUser}
        departments={departments}
        currentAssignments={userDepartmentsMap[deptDialogUser?.id] || []}
        onSave={handleSaveDepartments}
        saving={savingDepts}
      />

      {/* Improved Create / edit / delete / reset dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => !isSubmitting && setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        TransitionComponent={Fade}
        PaperProps={{ 
          sx: { 
            borderRadius: isMobile ? 0 : 2.5,
            maxHeight: '90vh',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 700, 
          borderBottom: '1px solid', 
          borderColor: 'divider', 
          pb: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          bgcolor: (t) => alpha(t.palette.primary.main, 0.02),
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {dialogMode === 'create' && <PersonAddOutlined color="primary" />}
              {dialogMode === 'edit' && <EditOutlined color="primary" />}
              {dialogMode === 'delete' && <DeleteOutlined color="error" />}
              {dialogMode === 'reset' && <KeyOutlined color="warning" />}
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {dialogMode === 'create' && 'Create New User'}
                {dialogMode === 'edit' && `Edit ${selectedUser?.username}`}
                {dialogMode === 'delete' && 'Delete User'}
                {dialogMode === 'reset' && `Reset Password · ${selectedUser?.username}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {dialogMode === 'create' && 'Add a new user to the system'}
                {dialogMode === 'edit' && 'Update user information and permissions'}
                {dialogMode === 'delete' && 'Permanently remove this user account'}
                {dialogMode === 'reset' && 'Set a new password for the user'}
              </Typography>
            </Box>
          </Box>
          {isMobile && (
            <IconButton size="small" onClick={() => !isSubmitting && setDialogOpen(false)}>
              <CloseOutlined fontSize="small" />
            </IconButton>
          )}
        </DialogTitle>

        <DialogContent sx={{ 
          pt: 3, 
          px: { xs: 2, sm: 3 },
          overflowY: 'auto',
          flex: 1,
        }}>
          {dialogMode === 'delete' ? (
            <Alert severity="error" icon={<WarningAmberOutlined />} sx={{ borderRadius: 1.5 }}>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                Are you sure you want to delete this user?
              </Typography>
              <Typography variant="body2">
                This will permanently remove <strong>{fullName(selectedUser)}</strong> (@{selectedUser?.username}) 
                from the system, including their account, role assignments, and department access.
              </Typography>
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                This action cannot be undone.
              </Typography>
            </Alert>
          ) : (
            <UserForm
              mode={dialogMode}
              formData={formData}
              setFormData={setFormData}
              passwordData={passwordData}
              setPasswordData={setPasswordData}
              formErrors={formErrors}
              rolesList={rolesList}
              departments={departments}
              selectedUser={selectedUser}
            />
          )}
        </DialogContent>

        <DialogActions sx={{ 
          px: { xs: 2, sm: 3 }, 
          py: 2, 
          borderTop: '1px solid', 
          borderColor: 'divider', 
          gap: 1,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.9),
        }}>
          <Button onClick={() => setDialogOpen(false)} disabled={isSubmitting} sx={{ borderRadius: 1.5 }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color={dialogMode === 'delete' ? 'error' : 'primary'}
            disabled={isSubmitting}
            sx={{ 
              minWidth: 150, 
              borderRadius: 1.5, 
              fontWeight: 700,
              px: 3,
            }}
            startIcon={isSubmitting ? null : (
              <>
                {dialogMode === 'create' && <PersonAddOutlined />}
                {dialogMode === 'edit' && <EditOutlined />}
                {dialogMode === 'delete' && <DeleteOutlined />}
                {dialogMode === 'reset' && <KeyOutlined />}
              </>
            )}
          >
            {isSubmitting ? <CircularProgress size={22} color="inherit" /> : (
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