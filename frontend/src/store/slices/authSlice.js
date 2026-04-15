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

    // 1. Handle String Detail
    if (typeof detail === 'string') {
      message = detail;
    } 
    // 2. Handle Object Detail
    else if (typeof detail === 'object' && !Array.isArray(detail) && detail !== null) {
      message = detail.message || message;
      errorCode = detail.error_code || detail.error;
      if (detail.field) {
        fieldErrors[detail.field] = message;
      }
      // Store additional metadata for special handling
      if (detail.wait_minutes) {
        fieldErrors.wait_minutes = detail.wait_minutes;
      }
      if (detail.email_sent === false) {
        fieldErrors.email_sent = false;
      }
    }
    // 3. Handle Array Detail (FastAPI validation)
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
  async (_, { rejectWithValue }) => {
    const token = localStorage.getItem('access_token');
    if (!token) return rejectWithValue(null);

    try {
      const response = await apiClient.get('/auth/me');
      const user = { ...response.data, email: response.data.email };
      localStorage.setItem('user', JSON.stringify(user));
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
        return { token: res.data.access_token, user: JSON.parse(localStorage.getItem('user')) };
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
   3. Async Thunks - Email & Password
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

/* =========================
   4. Async Thunks - Availability Checks
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
   5. Async Thunks - Profile Management
========================= */

export const updateUserProfile = createAsyncThunk(
  'auth/updateProfile',
  async (userData, { rejectWithValue }) => {
    try {
      console.log('🔵 updateUserProfile called with data:', userData);
      
      const token = localStorage.getItem('access_token');
      if (!token) {
        return rejectWithValue({ message: 'No authentication token found' });
      }
      
      // Filter only the fields that your backend accepts
      const allowedFields = {
        first_name: userData.first_name,
        last_name: userData.last_name,
        full_name: userData.full_name,
        phone: userData.phone,
      };
      
      // Remove undefined fields
      Object.keys(allowedFields).forEach(key => 
        allowedFields[key] === undefined && delete allowedFields[key]
      );
      
      const response = await apiClient.put('/auth/profile', allowedFields);
      
      // Update localStorage with new user data
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...currentUser, ...response.data };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      return response.data;
    } catch (err) {
      console.error('Update profile error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchProfilePicture = createAsyncThunk(
  'auth/fetchProfilePicture',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return rejectWithValue({ message: 'No authentication token found' });
      }
      
      const response = await apiClient.get('/auth/profile-picture');
      return response.data;
    } catch (err) {
      // If 404, no picture exists - that's fine
      if (err.response?.status === 404) {
        return { profile_picture: null };
      }
      console.error('Fetch profile picture error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const uploadProfilePicture = createAsyncThunk(
  'auth/uploadProfilePicture',
  async (file, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return rejectWithValue({ message: 'No authentication token found' });
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiClient.post('/auth/profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Update localStorage with new profile picture
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { 
        ...currentUser, 
        profile_picture: response.data.profile_picture,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      return response.data;
    } catch (err) {
      console.error('Upload profile picture error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const deleteProfilePicture = createAsyncThunk(
  'auth/deleteProfilePicture',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return rejectWithValue({ message: 'No authentication token found' });
      }
      
      const response = await apiClient.delete('/auth/profile-picture');
      
      // Update localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      delete currentUser.profile_picture;
      localStorage.setItem('user', JSON.stringify(currentUser));
      
      return response.data;
    } catch (err) {
      console.error('Delete profile picture error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);


/* =========================
   5. Async Thunks - Password Management
========================= */

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async ({ current_password, new_password }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return rejectWithValue({ message: 'No authentication token found' });
      }
      
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
   6. Initial State
========================= */

const initialState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
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
   7. Slice Definition
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
        errorCode: null
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
      .addCase(fetchProfilePicture.pending, (state) => {
        // Don't set loading to avoid UI disruption
      })
      .addCase(fetchProfilePicture.fulfilled, (state, action) => {
        if (action.payload?.profile_picture) {
          state.user = {
            ...state.user,
            profile_picture: action.payload.profile_picture
          };
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          currentUser.profile_picture = action.payload.profile_picture;
          localStorage.setItem('user', JSON.stringify(currentUser));
        }
      })
      .addCase(fetchProfilePicture.rejected, (state) => {
        // Silently fail - user just doesn't have a profile picture
      })

      // ==================== UPLOAD PROFILE PICTURE ====================
      .addCase(uploadProfilePicture.pending, (state) => {
        state.isUploading = true;
        state.error = null;
      })
      .addCase(uploadProfilePicture.fulfilled, (state, action) => {
        state.isUploading = false;
        state.user = { 
          ...state.user, 
          profile_picture: action.payload.profile_picture,
        };
        localStorage.setItem('user', JSON.stringify(state.user));
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
        if (state.user) {
          delete state.user.profile_picture;
        }
        localStorage.setItem('user', JSON.stringify(state.user));
        state.error = null;
      })
      .addCase(deleteProfilePicture.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload?.message || 'Failed to delete profile picture';
      })

      // ==================== LOGOUT ====================
      .addCase(logout.fulfilled, () => {
        return { 
          ...initialState, 
          user: null, 
          token: null, 
          isAuthenticated: false,
          error: null,
          fieldErrors: {},
          errorCode: null
        };
      })
      
      
      // ==================== CHANGE PASSWORD ====================
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
        // Optionally show success message
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to change password';
        state.fieldErrors = action.payload?.fieldErrors || {};
        state.errorCode = action.payload?.errorCode;
      })
      
      
      ;
  },
});

/* =========================
   8. Exports & Selectors
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
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectIsAuthChecking = (state) => state.auth.isAuthChecking;
export const selectIsUploading = (state) => state.auth.isUploading;
export const selectIsDeleting = (state) => state.auth.isDeleting;
export const selectAuthError = (state) => state.auth.error;
export const selectFieldErrors = (state) => state.auth.fieldErrors;
export const selectVerificationEmailSent = (state) => state.auth.verificationEmailSent;
export const selectPendingVerificationEmail = (state) => state.auth.pendingVerificationEmail;
export const selectProfilePicture = (state) => state.auth.user?.profile_picture;

// Default export
export default authSlice.reducer;