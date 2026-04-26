import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../api/apiClient';

/* =========================
   1. Helper Functions
========================= */

const normalizeError = (err) => {
  const responseData = err.response?.data;
  let message = 'An unexpected error occurred';
  let fieldErrors = {};
  let status = err.response?.status || 500;
  let errorCode = null;

  if (responseData?.detail) {
    const detail = responseData.detail;

    if (typeof detail === 'string') {
      message = detail;
    } 
    else if (typeof detail === 'object' && !Array.isArray(detail) && detail !== null) {
      message = detail.message || message;
      errorCode = detail.error_code || detail.error;
      if (detail.field) {
        fieldErrors[detail.field] = message;
      }
      if (detail.wait_minutes) {
        fieldErrors.wait_minutes = detail.wait_minutes;
      }
      if (detail.email_sent === false) {
        fieldErrors.email_sent = false;
      }
    }
    else if (Array.isArray(detail)) {
      message = detail[0]?.msg || 'Validation failed';
      detail.forEach(errItem => {
        if (errItem.loc && errItem.msg) {
          const field = errItem.loc[errItem.loc.length - 1];
          fieldErrors[field] = errItem.msg;
        }
      });
    }
    status = err.response?.status || status;
  }
  else if (responseData && typeof responseData === 'object') {
    message = responseData.message || responseData.error || message;
    if (responseData.field) {
      fieldErrors[responseData.field] = message;
    }
  }

  return { message: String(message), fieldErrors, status, errorCode };
};

const clearAuthStorage = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('profile_picture');
};

const persistAuth = (data) => {
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  
  const userToStore = data.user || {
    id: data.user_id,
    username: data.username,
    email: data.email,
    roles: data.roles,
    full_name: data.full_name,
    first_name: data.first_name,
    last_name: data.last_name,
    is_active: data.is_active,
    is_verified: data.is_verified,
    created_at: data.created_at,
  };
  
  localStorage.setItem('user', JSON.stringify(userToStore));
};

// Helper function to get user ID consistently
const getCurrentUserId = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.id || user.user_id;
};

/* =========================
   2. Async Thunks - Authentication
========================= */

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);
      formData.append('grant_type', 'password');

      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      const data = response.data;
      if (!data.email && data.user?.email) data.email = data.user.email;
      
      persistAuth(data);
      return data;
    } catch (err) {
      console.error('Login API error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const formattedData = {
        email: userData.email?.trim().toLowerCase(),
        username: userData.username?.trim(),
        password: userData.password,
        full_name: userData.full_name?.trim(),
        first_name: userData.first_name?.trim(),
        last_name: userData.last_name?.trim(),
      };
      
      const response = await apiClient.post('/auth/register', formattedData);
      return response.data;
    } catch (err) {
      console.error('Register API error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue, dispatch }) => {
    const token = localStorage.getItem('access_token');
    if (!token) return rejectWithValue(null);

    try {
      const response = await apiClient.get('/auth/me');
      const user = { ...response.data, email: response.data.email };
      localStorage.setItem('user', JSON.stringify(user));
      
      // Fetch profile picture separately
      await dispatch(fetchProfilePicture());
      
      return { token, user };
    } catch (err) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        clearAuthStorage();
        return rejectWithValue(null);
      }
      try {
        const res = await apiClient.post('/auth/refresh', { refresh_token: refreshToken });
        localStorage.setItem('access_token', res.data.access_token);
        const userResponse = await apiClient.get('/auth/me');
        localStorage.setItem('user', JSON.stringify(userResponse.data));
        await dispatch(fetchProfilePicture());
        return { token: res.data.access_token, user: userResponse.data };
      } catch (refreshErr) {
        clearAuthStorage();
        return rejectWithValue(null);
      }
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      clearAuthStorage();
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refresh_token: refreshToken });
      }
    } catch (err) {
      console.warn('Logout API error:', err.message);
    }
    return null;
  }
);

/* =========================
   3. Async Thunks - Profile Picture
========================= */

export const fetchProfilePicture = createAsyncThunk(
  'auth/fetchProfilePicture',
  async (_, { rejectWithValue }) => {
    try {
      const userId = getCurrentUserId();
      
      if (!userId) {
        return { has_picture: false, profile_picture: null };
      }
      
      // Use the base64 endpoint to get JSON response
      const response = await apiClient.get(`/auth/${userId}/profile-picture/base64`);
      return response.data;
    } catch (err) {
      // Don't reject on 404 - just return null (no profile picture)
      if (err.response?.status === 404) {
        return { has_picture: false, profile_picture: null };
      }
      console.error('Fetch profile picture error:', err.response?.data);
      return { has_picture: false, profile_picture: null };
    }
  }
);

export const uploadProfilePicture = createAsyncThunk(
  'auth/uploadProfilePicture',
  async (file, { rejectWithValue, dispatch }) => {
    try {
      const userId = getCurrentUserId();
      
      if (!userId) {
        return rejectWithValue({ message: 'User ID not found' });
      }
      
      // Convert file to base64 for base64 endpoint
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
      });
      
      // Use base64 endpoint for upload with compression
      const response = await apiClient.patch(`/auth/${userId}/profile-picture/base64`, {
        profile_picture: base64
      });
      
      // Refresh profile picture after upload
      await dispatch(fetchProfilePicture());
      
      return response.data;
    } catch (err) {
      console.error('Upload profile picture error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const deleteProfilePicture = createAsyncThunk(
  'auth/deleteProfilePicture',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      const userId = getCurrentUserId();
      
      if (!userId) {
        return rejectWithValue({ message: 'User ID not found' });
      }
      
      const response = await apiClient.delete(`/auth/${userId}/profile-picture`);
      
      // Refresh profile picture after deletion
      await dispatch(fetchProfilePicture());
      
      return response.data;
    } catch (err) {
      console.error('Delete profile picture error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

/* =========================
   4. Async Thunks - Profile Management
========================= */

export const updateUserProfile = createAsyncThunk(
  'auth/updateProfile',
  async (userData, { rejectWithValue, getState }) => {
    try {
      // Get current user ID from localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = currentUser.id || currentUser.user_id;
      
      if (!userId) {
        return rejectWithValue({ message: 'User ID not found' });
      }
      // Use the correct endpoint with user_id
      const response = await apiClient.patch(`/auth/${userId}`, userData);
      
      // Update localStorage with new user data
      const updatedUser = { ...currentUser, ...response.data };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      return response.data;
    } catch (err) {
      console.error('Update profile error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);
/* =========================
   5. Async Thunks - Email & Password
========================= */

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async (token, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/auth/verify-email?token=${token}`);
      return response.data;
    } catch (err) {
      console.error('Verify email error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const resendVerification = createAsyncThunk(
  'auth/resendVerification',
  async (email, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/auth/resend-verification', { email });
      return response.data;
    } catch (err) {
      console.error('Resend verification error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (email, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/auth/forgot-password', { email });
      return response.data;
    } catch (err) {
      console.error('Forgot password error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ token, new_password }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/auth/reset-password', { token, new_password });
      return response.data;
    } catch (err) {
      console.error('Reset password error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async ({ current_password, new_password }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/auth/change-password', {
        current_password,
        new_password,
      });
      return response.data;
    } catch (err) {
      console.error('Change password error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

/* =========================
   6. Async Thunks - Availability Checks
========================= */

export const checkUsernameAvailability = createAsyncThunk(
  'auth/checkUsername',
  async (username, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/auth/check-username?username=${username}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

export const checkEmailAvailability = createAsyncThunk(
  'auth/checkEmail',
  async (email, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/auth/check-email?email=${email}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

/* =========================
   7. Initial State
========================= */

const initialState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  profilePicture: null, // Don't store in localStorage - too large
  token: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  isAuthChecking: false,
  isUploading: false,
  isDeleting: false,
  registrationSuccess: false,
  verificationEmailSent: false,
  pendingVerificationEmail: null,
  error: null,
  fieldErrors: {},
  errorCode: null,
};

/* =========================
   8. Slice Definition
========================= */

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.fieldErrors = {};
      state.errorCode = null;
    },
    resetRegistrationSuccess: (state) => {
      state.registrationSuccess = false;
    },
    resetLoginSuccess: (state) => {
      state.error = null;
      state.fieldErrors = {};
      state.errorCode = null;
    },
    resetVerificationState: (state) => {
      state.verificationEmailSent = false;
      state.pendingVerificationEmail = null;
    },
    logoutLocal: () => {
      clearAuthStorage();
      return { 
        ...initialState, 
        user: null, 
        token: null, 
        isAuthenticated: false,
        error: null,
        fieldErrors: {},
        errorCode: null,
        profilePicture: null
      };
    },
    updateUserEmail: (state, action) => {
      if (state.user) {
        state.user.email = action.payload;
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // ==================== CHECK AUTH ====================
      .addCase(checkAuth.pending, (state) => { 
        state.isAuthChecking = true; 
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isAuthChecking = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isAuthChecking = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.profilePicture = null;
      })
      
      // ==================== LOGIN ====================
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.token = action.payload.access_token;
        state.user = action.payload.user || action.payload;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.error = action.payload?.message || 'Login failed';
        state.fieldErrors = action.payload?.fieldErrors || {};
        state.errorCode = action.payload?.errorCode;
      })
      
      // ==================== REGISTER ====================
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.registrationSuccess = true;
        state.verificationEmailSent = true;
        state.pendingVerificationEmail = action.payload?.email;
        if (action.payload) state.user = action.payload;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.registrationSuccess = false;
        state.error = action.payload?.message || 'Registration failed';
        state.fieldErrors = action.payload?.fieldErrors || {};
        state.errorCode = action.payload?.errorCode;
        
        if (state.errorCode === 'VERIFICATION_RESENT') {
          state.verificationEmailSent = true;
          state.pendingVerificationEmail = action.payload?.fieldErrors?.email ? 
            action.payload.fieldErrors.email.split(' ').pop() : null;
        }
      })

      // ==================== VERIFY EMAIL ====================
      .addCase(verifyEmail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
        if (state.user) {
          state.user.is_verified = true;
          localStorage.setItem('user', JSON.stringify(state.user));
        }
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Verification failed';
      })

      // ==================== RESEND VERIFICATION ====================
      .addCase(resendVerification.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resendVerification.fulfilled, (state) => {
        state.isLoading = false;
        state.verificationEmailSent = true;
        state.error = null;
      })
      .addCase(resendVerification.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to resend verification';
      })

      // ==================== FORGOT PASSWORD ====================
      .addCase(forgotPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to send reset email';
      })

      // ==================== RESET PASSWORD ====================
      .addCase(resetPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to reset password';
      })

      // ==================== UPDATE PROFILE ====================
      .addCase(updateUserProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('user', JSON.stringify(state.user));
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to update profile';
        state.fieldErrors = action.payload?.fieldErrors || {};
        state.errorCode = action.payload?.errorCode;
      })

      // ==================== FETCH PROFILE PICTURE ====================
      .addCase(fetchProfilePicture.fulfilled, (state, action) => {
        if (action.payload?.has_picture && action.payload?.profile_picture) {
          // Store the data URL directly (already includes data:image prefix)
          state.profilePicture = action.payload.profile_picture;
        } else {
          state.profilePicture = null;
        }
      })
      .addCase(fetchProfilePicture.rejected, (state) => {
        state.profilePicture = null;
      })

      // ==================== UPLOAD PROFILE PICTURE ====================
      .addCase(uploadProfilePicture.pending, (state) => {
        state.isUploading = true;
        state.error = null;
      })
      .addCase(uploadProfilePicture.fulfilled, (state) => {
        state.isUploading = false;
        state.error = null;
      })
      .addCase(uploadProfilePicture.rejected, (state, action) => {
        state.isUploading = false;
        state.error = action.payload?.message || 'Failed to upload profile picture';
      })

      // ==================== DELETE PROFILE PICTURE ====================
      .addCase(deleteProfilePicture.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteProfilePicture.fulfilled, (state) => {
        state.isDeleting = false;
        state.profilePicture = null;
        state.error = null;
      })
      .addCase(deleteProfilePicture.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload?.message || 'Failed to delete profile picture';
      })

      // ==================== LOGOUT ====================
      .addCase(logout.fulfilled, () => {
        clearAuthStorage();
        return { 
          ...initialState, 
          user: null, 
          token: null, 
          isAuthenticated: false,
          error: null,
          fieldErrors: {},
          errorCode: null,
          profilePicture: null
        };
      })
      
      // ==================== CHANGE PASSWORD ====================
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to change password';
        state.fieldErrors = action.payload?.fieldErrors || {};
        state.errorCode = action.payload?.errorCode;
      });
  },
});

/* =========================
   9. Exports & Selectors
========================= */

export const { 
  clearError, 
  resetRegistrationSuccess, 
  resetLoginSuccess,
  resetVerificationState,
  logoutLocal, 
  updateUserEmail 
} = authSlice.actions;

// Selectors
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectProfilePicture = (state) => state.auth.profilePicture;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectIsAuthChecking = (state) => state.auth.isAuthChecking;
export const selectIsUploading = (state) => state.auth.isUploading;
export const selectIsDeleting = (state) => state.auth.isDeleting;
export const selectAuthError = (state) => state.auth.error;
export const selectFieldErrors = (state) => state.auth.fieldErrors;
export const selectVerificationEmailSent = (state) => state.auth.verificationEmailSent;
export const selectPendingVerificationEmail = (state) => state.auth.pendingVerificationEmail;

// Default export
export default authSlice.reducer;