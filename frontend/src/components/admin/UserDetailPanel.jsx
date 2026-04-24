import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  CircularProgress,
  Divider,
  IconButton,
  Chip,
  Stack,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Tooltip,
  Alert,
  Slide,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  Edit,
  Save,
  Close,
  PersonOutline,
  EmailOutlined,
  PhoneOutlined,
  AdminPanelSettingsOutlined,
  VerifiedUserOutlined,
  LockOpenOutlined,
  LockOutlined,
  ArrowBack,
  BadgeOutlined,
  CalendarTodayOutlined,
  AccessTimeOutlined,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { updateUser, updateUserRoles } from '../../store/slices/adminSlice';
import { fetchRoles, selectAllRoles, selectRolesLoading } from '../../store/slices/roleSlice';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: { maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP, width: 250 },
  },
};

// Read-only info row
const InfoRow = ({ icon: Icon, label, value, mono = false }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        py: 1.25,
        px: 1.5,
        borderRadius: 1.5,
        transition: 'background 0.15s',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
      }}
    >
      <Icon
        fontSize="small"
        sx={{ mt: 0.25, color: 'text.secondary', flexShrink: 0 }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.25, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          color="text.primary"
          sx={{ fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}
        >
          {value || '—'}
        </Typography>
      </Box>
    </Box>
  );
};

const UserDetailPanel = ({ user, onClose, onUpdated }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();

  const rolesList = useSelector(selectAllRoles);
  const rolesLoading = useSelector(selectRolesLoading);

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});

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

  useEffect(() => {
    dispatch(fetchRoles());
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
        roles: [...(user.roles || [])],
        is_active: user.is_active ?? true,
        is_verified: user.is_verified ?? false,
      });
      setIsEditing(false);
      setError('');
      setSuccess('');
      setFormErrors({});
    }
  }, [user]);

  if (!user) return null;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const initials = (user.first_name?.[0] || user.username?.[0] || 'U').toUpperCase();

  const getRoleDetails = (roleCode) => {
    const role = rolesList?.find(r => r.code === roleCode);
    return {
      name: role?.name || roleCode,
      color: roleCode === 'admin' ? 'error' : roleCode === 'manager' ? 'warning' : 'primary',
    };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleRoleChange = (e) => {
    setFormData(prev => ({ ...prev, roles: [...e.target.value] }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = 'Email is invalid';
    if (!formData.username) errs.username = 'Username is required';
    else if (formData.username.length < 3) errs.username = 'At least 3 characters';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setError('');
    try {
      await dispatch(updateUser({
        id: user.id,
        email: formData.email,
        username: formData.username,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        is_active: formData.is_active,
        is_verified: formData.is_verified,
      })).unwrap();

      const currentRoles = [...(user.roles || [])].sort();
      const newRoles = [...(formData.roles || [])].sort();
      if (JSON.stringify(currentRoles) !== JSON.stringify(newRoles)) {
        await dispatch(updateUserRoles({ id: user.id, roles: [...newRoles] })).unwrap();
      }

      setSuccess('User updated successfully');
      setIsEditing(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      email: user.email || '',
      username: user.username || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      roles: [...(user.roles || [])],
      is_active: user.is_active ?? true,
      is_verified: user.is_verified ?? false,
    });
    setFormErrors({});
    setError('');
    setIsEditing(false);
  };

  return (
    <Slide direction="left" in mountOnEnter unmountOnExit>
      <Paper
        elevation={0}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {/* ── Header Banner ── */}
        <Box
          sx={{
            position: 'relative',
            background: theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.6)} 0%, ${alpha(theme.palette.secondary.dark, 0.4)} 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.3)} 0%, ${alpha(theme.palette.secondary.light, 0.2)} 100%)`,
            pt: 4,
            pb: 7,
            px: 3,
          }}
        >
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              bgcolor: alpha(theme.palette.background.paper, 0.7),
              backdropFilter: 'blur(4px)',
              '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.15), color: 'error.main' },
            }}
          >
            <Close fontSize="small" />
          </IconButton>

          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1.5, fontSize: '0.65rem' }}>
            User Detail
          </Typography>
          <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={700} color="text.primary" sx={{ mt: 0.5 }}>
            {fullName}
          </Typography>
        </Box>

        {/* ── Avatar (overlapping banner) ── */}
        <Box sx={{ px: 3, mt: -5, mb: 1, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <Avatar
            sx={{
              width: 80,
              height: 80,
              fontSize: 28,
              fontWeight: 700,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              border: '3px solid',
              borderColor: 'background.paper',
              boxShadow: theme.shadows[4],
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ pb: 0.5 }}>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                label={user.is_active ? 'Active' : 'Inactive'}
                size="small"
                color={user.is_active ? 'success' : 'default'}
                icon={user.is_active ? <LockOpenOutlined /> : <LockOutlined />}
                sx={{ fontWeight: 600 }}
              />
              {user.is_verified && (
                <Chip
                  label="Verified"
                  size="small"
                  color="info"
                  icon={<VerifiedUserOutlined />}
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Stack>
          </Box>
        </Box>

        {/* ── Scrollable body ── */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 3 }}>

          {/* Alerts */}
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          {/* ── Edit toggle ── */}
          {!isEditing ? (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<Edit />}
                onClick={() => setIsEditing(true)}
                sx={{ borderRadius: 2 }}
              >
                Edit User
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
              <Button size="small" variant="outlined" onClick={handleCancel} disabled={isSubmitting} sx={{ borderRadius: 2 }}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={isSubmitting ? <CircularProgress size={14} /> : <Save />}
                onClick={handleSave}
                disabled={isSubmitting}
                sx={{ borderRadius: 2 }}
              >
                Save Changes
              </Button>
            </Box>
          )}

          {/* ── VIEW MODE ── */}
          {!isEditing && (
            <>
              <Typography variant="overline" sx={{ color: 'text.disabled', px: 1.5, fontSize: '0.65rem', letterSpacing: 1 }}>
                Identity
              </Typography>
              <Paper variant="outlined" sx={{ borderRadius: 1.5, mb: 2, overflow: 'hidden', bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                <InfoRow icon={PersonOutline} label="Full Name" value={fullName} />
                <Divider />
                <InfoRow icon={BadgeOutlined} label="Username" value={`@${user.username}`} mono />
                <Divider />
                <InfoRow icon={EmailOutlined} label="Email" value={user.email} />
                {user.phone && (
                  <>
                    <Divider />
                    <InfoRow icon={PhoneOutlined} label="Phone" value={user.phone} />
                  </>
                )}
              </Paper>

              <Typography variant="overline" sx={{ color: 'text.disabled', px: 1.5, fontSize: '0.65rem', letterSpacing: 1 }}>
                Roles & Permissions
              </Typography>
              <Paper variant="outlined" sx={{ borderRadius: 1.5, mb: 2, p: 1.5, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                {(user.roles || []).length === 0 ? (
                  <Typography variant="body2" color="text.disabled" sx={{ px: 0.5 }}>No roles assigned</Typography>
                ) : (
                  <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
                    {(user.roles || []).map(roleCode => {
                      const { name, color } = getRoleDetails(roleCode);
                      return (
                        <Chip
                          key={roleCode}
                          label={name}
                          size="small"
                          color={color}
                          icon={<AdminPanelSettingsOutlined />}
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              <Typography variant="overline" sx={{ color: 'text.disabled', px: 1.5, fontSize: '0.65rem', letterSpacing: 1 }}>
                Activity
              </Typography>
              <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden', bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                <InfoRow
                  icon={CalendarTodayOutlined}
                  label="Joined"
                  value={user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
                />
                <Divider />
                <InfoRow
                  icon={AccessTimeOutlined}
                  label="Last Login"
                  value={user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                />
              </Paper>
            </>
          )}

          {/* ── EDIT MODE ── */}
          {isEditing && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  size="small"
                  InputProps={{ startAdornment: <PersonOutline sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} /> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  size="small"
                  InputProps={{ startAdornment: <PersonOutline sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} /> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  error={!!formErrors.username}
                  helperText={formErrors.username}
                  disabled={isSubmitting}
                  required
                  size="small"
                  InputProps={{ startAdornment: <BadgeOutlined sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} /> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                  disabled={isSubmitting}
                  required
                  size="small"
                  InputProps={{ startAdornment: <EmailOutlined sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} /> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  size="small"
                  InputProps={{ startAdornment: <PhoneOutlined sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} /> }}
                />
              </Grid>

              {/* Roles */}
              <Grid item xs={12}>
                <FormControl fullWidth size="small" disabled={isSubmitting}>
                  <InputLabel>Roles</InputLabel>
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
                  >
                    {rolesLoading ? (
                      <MenuItem disabled>
                        <CircularProgress size={18} sx={{ mr: 1 }} /> Loading…
                      </MenuItem>
                    ) : (
                      rolesList?.map(role => (
                        <MenuItem key={role.id} value={role.code}>
                          <Checkbox checked={(formData.roles || []).includes(role.code)} size="small" />
                          <ListItemText primary={role.name || role.code} secondary={role.description} />
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>

              {/* Toggles */}
              <Grid item xs={6}>
                <Paper
                  variant="outlined"
                  sx={{
                    px: 2, py: 1.5, borderRadius: 1.5,
                    borderColor: formData.is_active ? 'success.main' : 'divider',
                    bgcolor: formData.is_active ? alpha(theme.palette.success.main, 0.05) : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_active}
                        onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        disabled={isSubmitting}
                        color="success"
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={500}>
                        Active
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper
                  variant="outlined"
                  sx={{
                    px: 2, py: 1.5, borderRadius: 1.5,
                    borderColor: formData.is_verified ? 'info.main' : 'divider',
                    bgcolor: formData.is_verified ? alpha(theme.palette.info.main, 0.05) : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_verified}
                        onChange={e => setFormData(prev => ({ ...prev, is_verified: e.target.checked }))}
                        disabled={isSubmitting}
                        color="info"
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={500}>
                        Verified
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />
                </Paper>
              </Grid>

              {/* Read-only activity info */}
              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="overline" sx={{ color: 'text.disabled', fontSize: '0.65rem', letterSpacing: 1 }}>
                  Activity (read-only)
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last Login: {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>
    </Slide>
  );
};

export default UserDetailPanel;