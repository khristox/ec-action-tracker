import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Chip, IconButton,
  Divider, Stack, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, alpha,
  useTheme, Tooltip, Grid, Paper, Skeleton
} from '@mui/material';
import {
  CloseOutlined, EditOutlined, LockOutlined, EmailOutlined,
  PhoneOutlined, BusinessOutlined, VerifiedUserOutlined,
  LockOpenOutlined, AdminPanelSettingsOutlined, GroupsOutlined,
  ApartmentOutlined, LinkOutlined, PersonOutlined,
  AccessTimeOutlined, BadgeOutlined
} from '@mui/icons-material';
import { useDispatch } from 'react-redux';
import { updateUser, resetUserPassword } from '../../store/slices/adminSlice';
import api from '../../services/api';

// Role color mapping
const ROLE_COLORS = {
  admin: 'error',
  manager: 'warning',
  supervisor: 'info',
  user: 'default',
  head: 'error',
  member: 'default',
};

const UserDetailPanel = ({ user, onClose, onUpdated, departmentAssignments = [] }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [editMode, setEditMode] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [departmentsWithDetails, setDepartmentsWithDetails] = useState([]);

  // Fetch department details if not provided
  useEffect(() => {
    const fetchDepartmentDetails = async () => {
      if (!departmentAssignments || departmentAssignments.length === 0) {
        setDepartmentsWithDetails([]);
        return;
      }

      setLoadingDepts(true);
      try {
        // Fetch all departments to get names
        const response = await api.get('/departments');
        const allDepartments = response.data || [];
        
        // Map assignments with department details
        const enriched = departmentAssignments.map(assignment => {
          const dept = allDepartments.find(d => d.id === assignment.department_id);
          return {
            ...assignment,
            department_name: dept?.name || assignment.department_name || 'Unknown Department',
            department_description: dept?.description,
            is_active: dept?.is_active !== false,
          };
        });
        
        setDepartmentsWithDetails(enriched);
      } catch (error) {
        console.error('Error fetching department details:', error);
        // Fallback to provided data
        setDepartmentsWithDetails(departmentAssignments);
      } finally {
        setLoadingDepts(false);
      }
    };

    fetchDepartmentDetails();
  }, [departmentAssignments]);

  // Initialize form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
    });
    setError('');
  };

  const handleSaveEdit = async () => {
    if (!formData.email) {
      setError('Email is required');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Invalid email format');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await dispatch(updateUser({
        id: user.id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        is_active: user.is_active,
        is_verified: user.is_verified,
        is_superuser: user.is_superuser,
      })).unwrap();
      
      setEditMode(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!passwordData.password) {
      setError('Password is required');
      return;
    }
    
    if (passwordData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (passwordData.password !== passwordData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await dispatch(resetUserPassword({
        user_id: user.id,
        new_password: passwordData.password,
      })).unwrap();
      
      setResetDialogOpen(false);
      setPasswordData({ password: '', confirm_password: '' });
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  // Get role details
  const getRoleDetails = (roleCode) => {
    const roleNames = {
      admin: 'Administrator',
      manager: 'Manager',
      supervisor: 'Supervisor',
      user: 'User',
      head: 'Department Head',
      member: 'Member',
    };
    return {
      name: roleNames[roleCode] || roleCode,
      color: ROLE_COLORS[roleCode] || 'default',
    };
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'visible',
        position: 'relative',
        bgcolor: 'background.paper',
      }}
    >
      {/* Close button */}
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          zIndex: 1,
          bgcolor: (t) => alpha(t.palette.common.black, 0.05),
          '&:hover': { bgcolor: (t) => alpha(t.palette.common.black, 0.1) },
        }}
        size="small"
      >
        <CloseOutlined fontSize="small" />
      </IconButton>

      <CardContent sx={{ p: 3 }}>
        {/* Header with avatar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: user.is_superuser ? 'warning.main' : 'primary.main',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {user.first_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              @{user.username}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
              {user.is_superuser && (
                <Chip
                  label="Super Admin"
                  size="small"
                  color="warning"
                  icon={<AdminPanelSettingsOutlined sx={{ fontSize: 14 }} />}
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
              <Chip
                label={user.is_active ? 'Active' : 'Inactive'}
                size="small"
                color={user.is_active ? 'success' : 'default'}
                icon={user.is_active ? <LockOpenOutlined sx={{ fontSize: 14 }} /> : <LockOutlined sx={{ fontSize: 14 }} />}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
              {user.is_verified && (
                <Chip
                  label="Verified"
                  size="small"
                  color="info"
                  icon={<VerifiedUserOutlined sx={{ fontSize: 14 }} />}
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Stack>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* User Information */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PersonOutlined fontSize="small" />
          User Information
        </Typography>

        {editMode ? (
          <Stack spacing={2}>
            <TextField
              label="First Name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              size="small"
              fullWidth
            />
            <TextField
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              size="small"
              fullWidth
            />
            <TextField
              label="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              size="small"
              fullWidth
              required
              error={!!error && !formData.email}
            />
            <TextField
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              size="small"
              fullWidth
            />
            
            {error && (
              <Alert severity="error" sx={{ py: 0 }}>
                {error}
              </Alert>
            )}
            
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={handleSaveEdit}
                disabled={loading}
                size="small"
              >
                {loading ? <CircularProgress size={20} /> : 'Save'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleCancelEdit}
                disabled={loading}
                size="small"
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmailOutlined fontSize="small" sx={{ color: 'text.secondary', width: 20 }} />
              <Typography variant="body2">{user.email}</Typography>
            </Box>
            
            {user.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhoneOutlined fontSize="small" sx={{ color: 'text.secondary', width: 20 }} />
                <Typography variant="body2">{user.phone}</Typography>
              </Box>
            )}
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BadgeOutlined fontSize="small" sx={{ color: 'text.secondary', width: 20 }} />
              <Typography variant="body2">
                Created: {formatDate(user.created_at)}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeOutlined fontSize="small" sx={{ color: 'text.secondary', width: 20 }} />
              <Typography variant="body2">
                Last login: {formatDate(user.last_login)}
              </Typography>
            </Box>
            
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditOutlined />}
                onClick={handleEdit}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="warning"
                startIcon={<LockOutlined />}
                onClick={() => setResetDialogOpen(true)}
              >
                Reset Password
              </Button>
            </Stack>
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Roles */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <GroupsOutlined fontSize="small" />
          Roles & Permissions
        </Typography>
        
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {user.roles && user.roles.length > 0 ? (
            user.roles.map((role) => {
              const { name, color } = getRoleDetails(role);
              return (
                <Chip
                  key={role}
                  label={name}
                  size="small"
                  color={color}
                  variant={role === 'admin' ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 600 }}
                />
              );
            })
          ) : (
            <Typography variant="caption" color="text.secondary">
              No roles assigned
            </Typography>
          )}
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Department Assignments */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ApartmentOutlined fontSize="small" />
          Department Assignments
          {departmentsWithDetails.length > 0 && (
            <Chip
              label={departmentsWithDetails.length}
              size="small"
              color="primary"
              sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }}
            />
          )}
        </Typography>

        {loadingDepts ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : departmentsWithDetails.length > 0 ? (
          <Stack spacing={1}>
            {departmentsWithDetails.map((assignment) => {
              const roleConfig = ROLE_PALETTE?.[assignment.role] || ROLE_PALETTE?.member;
              return (
                <Paper
                  key={assignment.department_id}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.02),
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {assignment.department_name}
                    </Typography>
                    <Chip
                      label={roleConfig?.label || assignment.role || 'Member'}
                      size="small"
                      sx={{
                        bgcolor: roleConfig?.bgColor || '#f0f0f0',
                        color: roleConfig?.textColor || '#666',
                        fontWeight: 600,
                        height: 22,
                        fontSize: '0.7rem',
                      }}
                    />
                  </Box>
                  {assignment.department_description && (
                    <Typography variant="caption" color="text.secondary">
                      {assignment.department_description}
                    </Typography>
                  )}
                  {assignment.is_active === false && (
                    <Chip
                      label="Inactive Department"
                      size="small"
                      color="warning"
                      variant="outlined"
                      sx={{ mt: 0.5, height: 18, fontSize: '0.6rem' }}
                    />
                  )}
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Box
            sx={{
              py: 3,
              textAlign: 'center',
              bgcolor: alpha(theme.palette.common.black, 0.02),
              borderRadius: 1.5,
            }}
          >
            <BusinessOutlined sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No department assignments
            </Typography>
            <Typography variant="caption" color="text.disabled">
              This user is not assigned to any department
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => !loading && setResetDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Reset Password
          <Typography variant="caption" color="text.secondary" display="block">
            For {user.first_name || user.username}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="New Password"
              type="password"
              value={passwordData.password}
              onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
              fullWidth
              size="small"
              helperText="Minimum 8 characters"
            />
            <TextField
              label="Confirm Password"
              type="password"
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
              fullWidth
              size="small"
            />
            {error && (
              <Alert severity="error" sx={{ py: 0 }}>
                {error}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleResetPassword}
            variant="contained"
            color="warning"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Reset Password'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

// ROLE_PALETTE for department role styling
const ROLE_PALETTE = {
  head:       { color: 'error',   label: 'Head',       bgColor: '#fef2f2', borderColor: '#fca5a5', textColor: '#b91c1c' },
  manager:    { color: 'warning', label: 'Manager',    bgColor: '#fffbeb', borderColor: '#fcd34d', textColor: '#92400e' },
  supervisor: { color: 'info',    label: 'Supervisor', bgColor: '#eff6ff', borderColor: '#93c5fd', textColor: '#1d4ed8' },
  member:     { color: 'default', label: 'Member',     bgColor: '#f9fafb', borderColor: '#d1d5db', textColor: '#374151' },
  temporary:  { color: 'warning', label: 'Temp',       bgColor: '#fffbeb', borderColor: '#fcd34d', textColor: '#92400e' },
  contractor: { color: 'default', label: 'Contractor', bgColor: '#f9fafb', borderColor: '#d1d5db', textColor: '#374151' },
};

export default UserDetailPanel;