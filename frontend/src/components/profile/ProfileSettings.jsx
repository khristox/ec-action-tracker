import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Snackbar,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { 
  PhotoCamera, 
  Save, 
  Cancel, 
  Edit, 
  PersonOutline, 
  EmailOutlined, 
  PhoneOutlined,
  DeleteOutline,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { 
  updateUserProfile, 
  uploadProfilePicture, 
  deleteProfilePicture,
  fetchProfilePicture 
} from '../../store/slices/authSlice';

// Image compression utility
const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          }, 'image/jpeg', quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const ProfileSettings = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const { user, isLoading: authLoading } = useSelector((state) => state.auth);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetchingPicture, setIsFetchingPicture] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });

  const profilePictureUrl = user?.profile_picture || null;
  
  useEffect(() => {
    const loadProfilePicture = async () => {
      setIsFetchingPicture(true);
      try { await dispatch(fetchProfilePicture()).unwrap(); }
      catch (e) { console.log('Profile picture fetch skipped/failed'); }
      finally { setIsFetchingPicture(false); }
    };
    loadProfilePicture();
  }, [dispatch]);
  
  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || user.firstName || '',
        last_name: user.last_name || user.lastName || '',
        phone: user.phone || '',
      });
    }
  }, [user]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const updateData = { first_name: formData.first_name, last_name: formData.last_name, phone: formData.phone };
    setIsUpdating(true);
    try {
      await dispatch(updateUserProfile(updateData)).unwrap();
      setSnackbar({ open: true, message: 'Profile updated!', severity: 'success' });
      setIsEditing(false);
    } catch (error) {
      setSnackbar({ open: true, message: error.message || 'Update failed', severity: 'error' });
    } finally { setIsUpdating(false); }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      setUploadProgress(20);
      const compressedFile = await compressImage(file);
      setSelectedFile(compressedFile);
      setPreviewUrl(URL.createObjectURL(compressedFile));
      setUploadDialogOpen(true);
    } catch (error) {
      setSnackbar({ open: true, message: 'Process failed', severity: 'error' });
    } finally { setUploadProgress(0); }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      await dispatch(uploadProfilePicture(selectedFile)).unwrap();
      setSnackbar({ open: true, message: 'Avatar updated!', severity: 'success' });
      setUploadDialogOpen(false);
    } catch (error) {
      setSnackbar({ open: true, message: 'Upload failed', severity: 'error' });
    } finally { setIsUploading(false); }
  };

  const handleCancel = () => {
    setFormData({ first_name: user?.first_name || '', last_name: user?.last_name || '', phone: user?.phone || '' });
    setIsEditing(false);
  };

  if (authLoading || isFetchingPicture) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: isMobile ? 1 : 3,
      minHeight: '100vh',
      bgcolor: 'background.default'
    }}>
      <Paper sx={{ 
        p: isMobile ? 2 : 4, 
        borderRadius: isMobile ? 0 : 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider'
      }}>
        {/* Header Section */}
        <Stack 
          direction={isMobile ? "column" : "row"} 
          justifyContent="space-between" 
          alignItems={isMobile ? "flex-start" : "center"} 
          spacing={2} 
          sx={{ mb: 4 }}
        >
          <Typography variant={isMobile ? "h5" : "h4"} fontWeight={700} color="text.primary">
            Profile Settings
          </Typography>
          {!isEditing && (
            <Button
              fullWidth={isMobile}
              variant="contained"
              onClick={() => setIsEditing(true)}
              startIcon={<Edit />}
              sx={{ 
                borderRadius: 2,
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' }
              }}
            >
              Edit Profile
            </Button>
          )}
        </Stack>
        
        <form onSubmit={handleSubmit}>
          <Grid container spacing={isMobile ? 2 : 3}>
            {/* Avatar Section */}
            <Grid item xs={12} sx={{ textAlign: 'center', mb: 2 }}>
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  sx={{ 
                    width: isMobile ? 100 : 140, 
                    height: isMobile ? 100 : 140, 
                    mx: 'auto', 
                    fontSize: isMobile ? 32 : 48, 
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    border: '3px solid',
                    borderColor: 'primary.light'
                  }}
                  src={profilePictureUrl}
                >
                  {user?.email?.[0].toUpperCase()}
                </Avatar>
                <Stack direction="row" spacing={1} sx={{ position: 'absolute', bottom: -10, right: isMobile ? -10 : 0 }}>
                  <IconButton
                    color="primary"
                    component="label"
                    sx={{ 
                      bgcolor: 'background.paper', 
                      boxShadow: 3, 
                      '&:hover': { 
                        bgcolor: 'action.hover',
                        transform: 'scale(1.05)'
                      },
                      transition: 'transform 0.2s'
                    }}
                  >
                    <input hidden accept="image/*" type="file" onChange={handleFileSelect} ref={fileInputRef} />
                    <PhotoCamera fontSize="small" />
                  </IconButton>
                  {profilePictureUrl && (
                    <IconButton
                      color="error"
                      onClick={() => dispatch(deleteProfilePicture())}
                      sx={{ 
                        bgcolor: 'background.paper', 
                        boxShadow: 3, 
                        '&:hover': { 
                          bgcolor: 'error.dark',
                          color: 'error.contrastText'
                        },
                        transition: 'all 0.2s'
                      }}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </Box>
            </Grid>

            {/* Input Fields */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="First Name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                disabled={!isEditing}
                InputProps={{ 
                  startAdornment: <PersonOutline sx={{ mr: 1, opacity: 0.5, color: 'text.secondary' }} /> 
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'divider' },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                  },
                  '& .MuiInputLabel-root': { color: 'text.secondary' },
                  '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Last Name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                disabled={!isEditing}
                InputProps={{ 
                  startAdornment: <PersonOutline sx={{ mr: 1, opacity: 0.5, color: 'text.secondary' }} /> 
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'divider' },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                  },
                  '& .MuiInputLabel-root': { color: 'text.secondary' },
                  '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                value={user?.email || ''}
                disabled
                InputProps={{ 
                  startAdornment: <EmailOutlined sx={{ mr: 1, opacity: 0.5, color: 'text.secondary' }} /> 
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'divider' },
                    '&.Mui-disabled': { bgcolor: 'action.disabledBackground' }
                  },
                  '& .MuiInputLabel-root': { color: 'text.secondary' },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                disabled={!isEditing}
                InputProps={{ 
                  startAdornment: <PhoneOutlined sx={{ mr: 1, opacity: 0.5, color: 'text.secondary' }} /> 
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'divider' },
                    '&:hover fieldset': { borderColor: 'primary.main' },
                  },
                  '& .MuiInputLabel-root': { color: 'text.secondary' },
                  '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
                }}
              />
            </Grid>

            {isEditing && (
              <Grid item xs={12}>
                <Stack direction={isMobile ? "column" : "row"} spacing={2} justifyContent="flex-end" sx={{ mt: 2 }}>
                  <Button 
                    fullWidth={isMobile} 
                    variant="outlined" 
                    onClick={handleCancel}
                    sx={{
                      borderColor: 'divider',
                      color: 'text.primary',
                      '&:hover': {
                        borderColor: 'error.main',
                        bgcolor: 'error.dark',
                        color: 'error.contrastText'
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    fullWidth={isMobile} 
                    type="submit" 
                    variant="contained" 
                    disabled={isUpdating}
                    startIcon={isUpdating && <CircularProgress size={16} />}
                    sx={{
                      bgcolor: 'primary.main',
                      '&:hover': { bgcolor: 'primary.dark' },
                      '&.Mui-disabled': { bgcolor: 'action.disabledBackground' }
                    }}
                  >
                    Save Changes
                  </Button>
                </Stack>
              </Grid>
            )}
          </Grid>
        </form>

        <Divider sx={{ my: 4, borderColor: 'divider' }} />

        {/* Status and Roles Section */}
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1.5, fontWeight: 600, letterSpacing: 1 }}>
          STATUS & ROLES
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label={user?.is_verified ? "Verified" : "Unverified"} 
            color={user?.is_verified ? "success" : "warning"} 
            size="small"
            sx={{ 
              '& .MuiChip-label': { fontWeight: 500 },
              bgcolor: user?.is_verified ? 'success.dark' : 'warning.dark',
              color: user?.is_verified ? 'success.contrastText' : 'warning.contrastText'
            }}
          />
          <Chip 
            label={user?.is_active ? "Active Account" : "Inactive"} 
            color="info" 
            size="small"
            sx={{ 
              '& .MuiChip-label': { fontWeight: 500 },
              bgcolor: 'info.dark',
              color: 'info.contrastText'
            }}
          />
          {user?.roles?.map((r, i) => (
            <Chip 
              key={i} 
              label={r} 
              variant="outlined" 
              size="small"
              sx={{ 
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark', color: 'primary.contrastText' }
              }}
            />
          ))}
        </Box>
      </Paper>

      {/* Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        fullScreen={isMobile} 
        onClose={() => setUploadDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            borderRadius: isMobile ? 0 : 2,
            border: '1px solid',
            borderColor: 'divider'
          }
        }}
      >
        <DialogTitle sx={{ color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>
          Preview Photo
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pt: 3 }}>
          <Avatar 
            src={previewUrl} 
            sx={{ 
              width: isMobile ? 250 : 300, 
              height: isMobile ? 250 : 300, 
              mx: 'auto', 
              my: 2,
              border: '3px solid',
              borderColor: 'primary.main'
            }} 
          />
          {isUploading && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setUploadDialogOpen(false)} 
            disabled={isUploading}
            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpload} 
            disabled={isUploading}
            sx={{
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' }
            }}
          >
            Upload Now
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
      >
        <Alert 
          severity={snackbar.severity} 
          variant="filled" 
          sx={{ 
            width: '100%',
            bgcolor: snackbar.severity === 'success' ? 'success.dark' : 'error.dark',
            color: snackbar.severity === 'success' ? 'success.contrastText' : 'error.contrastText'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProfileSettings;