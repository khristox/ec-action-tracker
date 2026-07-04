// store/slices/authSlice.js - IMPROVED VERSION with Rate Limiting & Account Lock

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../api/apiClient';

/* =========================
   1. Constants & Configuration
========================= */

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  PROFILE_PICTURE: 'profile_picture',
  USER_PERMISSIONS: 'user_permissions',
  AUTH_STATE: 'auth_state',
};

const CACHE_CONFIG = {
  PROFILE_PICTURE_TTL: 5 * 60 * 1000, // 5 minutes
  PERMISSIONS_TTL: 10 * 60 * 1000, // 10 minutes
};

// Rate limiting constants
const RATE_LIMIT = {
  MAX_ATTEMPTS: 5,
  LOCK_DURATION: 15 * 60, // 15 minutes in seconds
  ATTEMPT_WINDOW: 15 * 60, // 15 minutes in seconds
};

/* =========================
   2. Helper Functions
========================= */

const normalizeError = (err) => {
  const responseData = err.response?.data;
  let message = 'An unexpected error occurred';
  let fieldErrors = {};
  let status = err.response?.status || 500;
  let errorCode = null;
  let retryAfter = null;
  let remainingAttempts = null;
  let lockDuration = null;

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
        lockDuration = detail.wait_minutes * 60;
      }
      if (detail.email_sent === false) {
        fieldErrors.email_sent = false;
      }
      if (detail.remaining_attempts !== undefined) {
        remainingAttempts = detail.remaining_attempts;
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
    if (responseData.remaining_attempts !== undefined) {
      remainingAttempts = responseData.remaining_attempts;
    }
  }

  // Check headers for rate limiting info
  if (err.response?.headers) {
    const retryHeader = err.response.headers['retry-after'];
    if (retryHeader) {
      retryAfter = parseInt(retryHeader);
    }
  }

  return { 
    message: String(message), 
    fieldErrors, 
    status, 
    errorCode,
    retryAfter,
    remainingAttempts,
    lockDuration,
  };
};

const clearAuthStorage = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  // Clear rate limiting state
  localStorage.removeItem('rate_limit_state');
  localStorage.removeItem('failed_attempts');
  localStorage.removeItem('lock_until');
};

const persistAuth = (data) => {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
  
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
    permissions: data.permissions || [],
  };
  
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userToStore));
  
  if (userToStore.permissions) {
    localStorage.setItem(STORAGE_KEYS.USER_PERMISSIONS, JSON.stringify(userToStore.permissions));
  }
  
  // Save auth state
  const authState = {
    isAuthenticated: true,
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEYS.AUTH_STATE, JSON.stringify(authState));
};

const getCurrentUserId = () => {
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
  return user.id || user.user_id;
};

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

const getTokenExpiration = (token) => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000;
  } catch {
    return null;
  }
};

const hasProfilePictureCached = () => {
  const flag = localStorage.getItem('has_profile_picture');
  if (!flag) return null;
  return flag === 'true';
};

const setProfilePicturePresence = (hasPicture) => {
  localStorage.setItem('has_profile_picture', hasPicture ? 'true' : 'false');
};

const getCachedProfilePicture = () => {
  return localStorage.getItem(STORAGE_KEYS.PROFILE_PICTURE);
};

const cacheProfilePicture = (pictureData) => {
  if (pictureData) {
    localStorage.setItem(STORAGE_KEYS.PROFILE_PICTURE, pictureData);
  } else {
    localStorage.removeItem(STORAGE_KEYS.PROFILE_PICTURE);
  }
};

// Rate limiting helpers
const getRateLimitState = () => {
  try {
    const state = JSON.parse(localStorage.getItem('rate_limit_state') || '{}');
    return {
      failedAttempts: state.failedAttempts || 0,
      lockUntil: state.lockUntil || null,
      remainingAttempts: state.remainingAttempts || RATE_LIMIT.MAX_ATTEMPTS,
      lastAttemptTime: state.lastAttemptTime || null,
    };
  } catch {
    return {
      failedAttempts: 0,
      lockUntil: null,
      remainingAttempts: RATE_LIMIT.MAX_ATTEMPTS,
      lastAttemptTime: null,
    };
  }
};

const saveRateLimitState = (state) => {
  localStorage.setItem('rate_limit_state', JSON.stringify(state));
};

const isAccountLocked = () => {
  const { lockUntil } = getRateLimitState();
  if (!lockUntil) return false;
  return Date.now() < lockUntil;
};

const getLockTimeRemaining = () => {
  const { lockUntil } = getRateLimitState();
  if (!lockUntil) return 0;
  const remaining = Math.floor((lockUntil - Date.now()) / 1000);
  return Math.max(0, remaining);
};

const resetRateLimitState = () => {
  localStorage.removeItem('rate_limit_state');
  localStorage.removeItem('failed_attempts');
  localStorage.removeItem('lock_until');
};

/* =========================
   3. Async Thunks with Rate Limiting
========================= */

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue, dispatch }) => {
    try {
      // Check if account is locked before making request
      const { lockUntil } = getRateLimitState();
      if (lockUntil && Date.now() < lockUntil) {
        const remaining = Math.floor((lockUntil - Date.now()) / 1000);
        return rejectWithValue({
          message: `Account is temporarily locked. Please wait ${Math.ceil(remaining / 60)} minutes.`,
          status: 403,
          errorCode: 'ACCOUNT_LOCKED',
          lockDuration: remaining,
          remainingAttempts: 0,
        });
      }

      const formData = new URLSearchParams();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);
      formData.append('grant_type', 'password');

      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      const data = response.data;
      
      // Reset rate limit state on successful login
      resetRateLimitState();
      
      // Fetch user permissions after login
      try {
        const permissionsResponse = await apiClient.get('/auth/me/permissions', {
          headers: { Authorization: `Bearer ${data.access_token}` }
        });
        data.permissions = permissionsResponse.data || [];
        if (data.user) {
          data.user.permissions = permissionsResponse.data;
        }
      } catch (permError) {
        console.warn('Could not fetch permissions:', permError);
        data.permissions = [];
      }
      
      persistAuth(data);
      
      // Clear profile picture cache on login (force refresh)
      setProfilePicturePresence(false);
      cacheProfilePicture(null);
      
      return data;
    } catch (err) {
      console.error('Login API error:', err.response?.data);
      
      // Handle rate limiting specifically
      const errorData = normalizeError(err);
      
      // If we get a 429, update rate limit state
      if (errorData.status === 429) {
        const currentState = getRateLimitState();
        saveRateLimitState({
          ...currentState,
          failedAttempts: currentState.failedAttempts + 1,
          lastAttemptTime: Date.now(),
        });
      }
      
      // If account is locked (403 with lock message)
      if (errorData.status === 403 && errorData.errorCode === 'ACCOUNT_LOCKED') {
        const lockDuration = errorData.lockDuration || RATE_LIMIT.LOCK_DURATION;
        saveRateLimitState({
          failedAttempts: RATE_LIMIT.MAX_ATTEMPTS,
          lockUntil: Date.now() + (lockDuration * 1000),
          remainingAttempts: 0,
          lastAttemptTime: Date.now(),
        });
      }
      
      // Handle invalid credentials with remaining attempts
      if (errorData.status === 401 && errorData.remainingAttempts !== null) {
        const currentState = getRateLimitState();
        saveRateLimitState({
          ...currentState,
          remainingAttempts: errorData.remainingAttempts,
          failedAttempts: RATE_LIMIT.MAX_ATTEMPTS - errorData.remainingAttempts,
        });
      }
      
      return rejectWithValue(errorData);
    }
  }
);

// Rest of your thunks remain the same, but with improved error handling
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
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return rejectWithValue(null);

    // Check if token is expired
    if (isTokenExpired(token)) {
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        clearAuthStorage();
        return rejectWithValue(null);
      }
      // Try to refresh token
      try {
        const res = await apiClient.post('/auth/refresh', { refresh_token: refreshToken });
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.data.access_token);
        // Continue with new token
        const userResponse = await apiClient.get('/auth/me');
        const user = userResponse.data;
        
        let permissions = [];
        try {
          const permissionsResponse = await apiClient.get('/auth/me/permissions');
          permissions = permissionsResponse.data || [];
          user.permissions = permissions;
        } catch (permError) {
          console.warn('Could not fetch permissions after refresh:', permError);
        }
        
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        localStorage.setItem(STORAGE_KEYS.USER_PERMISSIONS, JSON.stringify(permissions));
        await dispatch(fetchProfilePicture());
        return { token: res.data.access_token, user, permissions };
      } catch (refreshErr) {
        clearAuthStorage();
        return rejectWithValue(null);
      }
    }

    try {
      const response = await apiClient.get('/auth/me');
      const user = { ...response.data, email: response.data.email };
      
      // Fetch user permissions
      let permissions = [];
      try {
        const permissionsResponse = await apiClient.get('/auth/me/permissions');
        permissions = permissionsResponse.data || [];
        user.permissions = permissions;
      } catch (permError) {
        console.warn('Could not fetch permissions:', permError);
      }
      
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.USER_PERMISSIONS, JSON.stringify(permissions));
      
      // Fetch profile picture from the correct endpoint
      await dispatch(fetchProfilePicture());
      
      return { token, user, permissions };
    } catch (err) {
      // If we get 401, try to refresh
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        clearAuthStorage();
        return rejectWithValue(null);
      }
      try {
        const res = await apiClient.post('/auth/refresh', { refresh_token: refreshToken });
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.data.access_token);
        const userResponse = await apiClient.get('/auth/me');
        const user = userResponse.data;
        
        let permissions = [];
        try {
          const permissionsResponse = await apiClient.get('/auth/me/permissions');
          permissions = permissionsResponse.data || [];
          user.permissions = permissions;
        } catch (permError) {
          console.warn('Could not fetch permissions after refresh:', permError);
        }
        
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        localStorage.setItem(STORAGE_KEYS.USER_PERMISSIONS, JSON.stringify(permissions));
        await dispatch(fetchProfilePicture());
        return { token: res.data.access_token, user, permissions };
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
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      clearAuthStorage();
      resetRateLimitState();
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refresh_token: refreshToken }, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      }
    } catch (err) {
      console.warn('Logout API error:', err.message);
    }
    return null;
  }
);

// Profile picture thunks (unchanged but with improved error handling)
export const fetchProfilePicture = createAsyncThunk(
  'auth/fetchProfilePicture',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/auth/profile-picture');
      
      if (response.data?.has_picture && response.data?.profile_picture) {
        setProfilePicturePresence(true);
        cacheProfilePicture(response.data.profile_picture);
        return response.data;
      } else {
        setProfilePicturePresence(false);
        cacheProfilePicture(null);
        return { has_picture: false, profile_picture: null };
      }
    } catch (err) {
      // 404 means no profile picture - that's fine
      if (err.response?.status === 404) {
        setProfilePicturePresence(false);
        cacheProfilePicture(null);
        return { has_picture: false, profile_picture: null };
      }
      console.error('Fetch profile picture error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const fetchUserProfilePicture = createAsyncThunk(
  'auth/fetchUserProfilePicture',
  async (userId, { rejectWithValue }) => {
    try {
      if (!userId) {
        return { has_picture: false, profile_picture: null };
      }
      
      const response = await apiClient.get(`/auth/${userId}/profile-picture/base64`);
      
      if (response.data?.has_picture && response.data?.profile_picture) {
        return response.data;
      } else {
        return { has_picture: false, profile_picture: null };
      }
    } catch (err) {
      if (err.response?.status === 404) {
        return { has_picture: false, profile_picture: null };
      }
      console.error('Fetch user profile picture error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

export const uploadProfilePicture = createAsyncThunk(
  'auth/uploadProfilePicture',
  async (file, { rejectWithValue, dispatch }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiClient.patch('/auth/profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setProfilePicturePresence(false);
      cacheProfilePicture(null);
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
      const response = await apiClient.delete('/auth/profile-picture');
      
      setProfilePicturePresence(false);
      cacheProfilePicture(null);
      
      return response.data;
    } catch (err) {
      console.error('Delete profile picture error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

// Other thunks (updateUserProfile, verifyEmail, etc.) remain similar but with normalizeError
export const updateUserProfile = createAsyncThunk(
  'auth/updateProfile',
  async (userData, { rejectWithValue }) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
      const userId = currentUser.id || currentUser.user_id;
      
      if (!userId) {
        return rejectWithValue({ message: 'User ID not found' });
      }
      
      const response = await apiClient.patch(`/auth/${userId}`, userData);
      
      const updatedUser = { ...currentUser, ...response.data };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      
      return response.data;
    } catch (err) {
      console.error('Update profile error:', err.response?.data);
      return rejectWithValue(normalizeError(err));
    }
  }
);

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
   4. Permission Helper Functions
========================= */

export const hasPermission = (permissions, requiredPermission) => {
  if (!permissions || !Array.isArray(permissions)) return false;
  if (!requiredPermission) return true;
  
  return permissions.some(permission => {
    const permissionCode = typeof permission === 'object' ? permission.code : permission;
    return permissionCode === requiredPermission;
  });
};

export const hasAnyPermission = (permissions, requiredPermissions) => {
  if (!permissions || !Array.isArray(permissions)) return false;
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  
  return requiredPermissions.some(required => hasPermission(permissions, required));
};

export const hasAllPermissions = (permissions, requiredPermissions) => {
  if (!permissions || !Array.isArray(permissions)) return false;
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  
  return requiredPermissions.every(required => hasPermission(permissions, required));
};

/* =========================
   5. Initial State
========================= */

const rateLimitState = getRateLimitState();

// NOTE: permissionsLoaded distinguishes "we haven't checked permissions yet"
// from "we checked, and the user genuinely has none". Consumers (e.g.
// MeetingMinutes) must gate their access-denied UI on this flag, not just
// on userPermissions.length === 0, or they will render "Access Denied"
// during the brief window before checkAuth/login resolves.
const initialState = {
  user: JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || 'null'),
  userPermissions: JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_PERMISSIONS) || '[]'),
  permissionsLoaded: !!localStorage.getItem(STORAGE_KEYS.USER_PERMISSIONS),
  profilePicture: getCachedProfilePicture(),
  token: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
  isAuthenticated: !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
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
  profilePictureChecked: false,
  tokenExpiration: getTokenExpiration(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)),
  
  // Rate limiting state
  failedAttempts: rateLimitState.failedAttempts || 0,
  remainingAttempts: rateLimitState.remainingAttempts || RATE_LIMIT.MAX_ATTEMPTS,
  isLocked: isAccountLocked(),
  lockTimeRemaining: getLockTimeRemaining(),
  lastAttemptTime: rateLimitState.lastAttemptTime || null,
  isRateLimited: false,
  rateLimitRetryAfter: 0,
};

/* =========================
   6. Slice Definition
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
      resetRateLimitState();
      return { 
        ...initialState, 
        user: null, 
        token: null, 
        isAuthenticated: false,
        error: null,
        fieldErrors: {},
        errorCode: null,
        profilePicture: null,
        userPermissions: [],
        permissionsLoaded: false,
        failedAttempts: 0,
        remainingAttempts: RATE_LIMIT.MAX_ATTEMPTS,
        isLocked: false,
        lockTimeRemaining: 0,
        isRateLimited: false,
        rateLimitRetryAfter: 0,
      };
    },
    updateUserEmail: (state, action) => {
      if (state.user) {
        state.user.email = action.payload;
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.user));
      }
    },
    setUserPermissions: (state, action) => {
      state.userPermissions = action.payload;
      state.permissionsLoaded = true;
      if (state.user) {
        state.user.permissions = action.payload;
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.user));
      }
      localStorage.setItem(STORAGE_KEYS.USER_PERMISSIONS, JSON.stringify(action.payload));
    },
    clearProfilePictureCache: (state) => {
      state.profilePicture = null;
      state.profilePictureChecked = false;
      cacheProfilePicture(null);
      setProfilePicturePresence(false);
    },
    updateToken: (state, action) => {
      state.token = action.payload;
      state.tokenExpiration = getTokenExpiration(action.payload);
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, action.payload);
    },
    // Rate limiting reducers
    updateLockTimer: (state) => {
      if (state.isLocked && state.lockTimeRemaining > 0) {
        state.lockTimeRemaining -= 1;
        // Update lockUntil in localStorage
        const rateState = getRateLimitState();
        if (rateState.lockUntil) {
          const newLockUntil = Date.now() + (state.lockTimeRemaining * 1000);
          saveRateLimitState({
            ...rateState,
            lockUntil: newLockUntil,
          });
        }
        if (state.lockTimeRemaining === 0) {
          state.isLocked = false;
          state.failedAttempts = 0;
          state.remainingAttempts = RATE_LIMIT.MAX_ATTEMPTS;
          resetRateLimitState();
        }
      }
    },
    setRateLimited: (state, action) => {
      state.isRateLimited = true;
      state.rateLimitRetryAfter = action.payload || 30;
    },
    clearRateLimited: (state) => {
      state.isRateLimited = false;
      state.rateLimitRetryAfter = 0;
    },
    setRemainingAttempts: (state, action) => {
      state.remainingAttempts = action.payload;
      state.failedAttempts = RATE_LIMIT.MAX_ATTEMPTS - action.payload;
    },
    resetRateLimit: (state) => {
      state.failedAttempts = 0;
      state.remainingAttempts = RATE_LIMIT.MAX_ATTEMPTS;
      state.isLocked = false;
      state.lockTimeRemaining = 0;
      state.isRateLimited = false;
      state.rateLimitRetryAfter = 0;
      resetRateLimitState();
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
        state.user = action.payload.user;
        state.userPermissions = action.payload.permissions || [];
        state.permissionsLoaded = true;
        state.token = action.payload.token;
        state.tokenExpiration = getTokenExpiration(action.payload.token);
        state.isAuthenticated = true;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
        // Reset rate limit state on successful auth
        state.failedAttempts = 0;
        state.remainingAttempts = RATE_LIMIT.MAX_ATTEMPTS;
        state.isLocked = false;
        state.lockTimeRemaining = 0;
        state.isRateLimited = false;
        state.rateLimitRetryAfter = 0;
        resetRateLimitState();
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isAuthChecking = false;
        state.user = null;
        state.isAuthenticated = false;
        state.token = null;
        state.profilePicture = null;
        state.userPermissions = [];
        // A rejected auth check means the user is logged out, not that we're
        // still waiting. permissionsLoaded=false here is correct because
        // there IS no valid permission set for consumers to key off of, and
        // isAuthenticated=false should be what gates the UI at that point.
        state.permissionsLoaded = false;
        state.tokenExpiration = null;
      })
      
      // ==================== LOGIN ====================
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
        state.isRateLimited = false;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.access_token;
        state.tokenExpiration = getTokenExpiration(action.payload.access_token);
        state.isAuthenticated = true;
        state.userPermissions = action.payload.permissions || [];
        state.permissionsLoaded = true;
        state.error = null;
        state.fieldErrors = {};
        state.errorCode = null;
        state.isLocked = false;
        state.lockTimeRemaining = 0;
        state.failedAttempts = 0;
        state.remainingAttempts = RATE_LIMIT.MAX_ATTEMPTS;
        state.isRateLimited = false;
        state.rateLimitRetryAfter = 0;
        resetRateLimitState();

        state.user = action.payload.user || {
          id: action.payload.user_id,
          username: action.payload.username,
          email: action.payload.email,
          roles: action.payload.roles,
          full_name: action.payload.full_name,
          first_name: action.payload.first_name,
          last_name: action.payload.last_name,
          is_active: action.payload.is_active,
          is_verified: action.payload.is_verified,
          created_at: action.payload.created_at,
          permissions: action.payload.permissions || [],
        };
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Login failed';
        state.fieldErrors = action.payload?.fieldErrors || {};
        state.errorCode = action.payload?.errorCode;
        
        // Handle rate limiting
        if (action.payload?.status === 429) {
          state.isRateLimited = true;
          state.rateLimitRetryAfter = action.payload.retryAfter || 30;
          state.failedAttempts += 1;
          state.remainingAttempts = Math.max(0, RATE_LIMIT.MAX_ATTEMPTS - state.failedAttempts);
        }
        
        // Handle account lock
        if (action.payload?.errorCode === 'ACCOUNT_LOCKED' || action.payload?.status === 403) {
          state.isLocked = true;
          const lockDuration = action.payload.lockDuration || RATE_LIMIT.LOCK_DURATION;
          state.lockTimeRemaining = lockDuration;
          state.failedAttempts = RATE_LIMIT.MAX_ATTEMPTS;
          state.remainingAttempts = 0;
        }
        
        // Handle remaining attempts
        if (action.payload?.status === 401 && action.payload.remainingAttempts !== null) {
          state.remainingAttempts = action.payload.remainingAttempts;
          state.failedAttempts = RATE_LIMIT.MAX_ATTEMPTS - action.payload.remainingAttempts;
        }
        
        state.userPermissions = [];
        state.permissionsLoaded = false;
        if (action.payload?.status === 401) {
          state.isAuthenticated = false;
        }
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
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.user));
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
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.user));
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

      // ==================== FETCH MY PROFILE PICTURE ====================
      .addCase(fetchProfilePicture.pending, (state) => {
        state.profilePictureChecked = false;
      })
      .addCase(fetchProfilePicture.fulfilled, (state, action) => {
        state.profilePictureChecked = true;
        if (action.payload?.has_picture && action.payload?.profile_picture) {
          state.profilePicture = action.payload.profile_picture;
        } else {
          state.profilePicture = null;
        }
      })
      .addCase(fetchProfilePicture.rejected, (state) => {
        state.profilePictureChecked = true;
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
        resetRateLimitState();
        return { 
          ...initialState, 
          user: null, 
          token: null, 
          isAuthenticated: false,
          error: null,
          fieldErrors: {},
          errorCode: null,
          profilePicture: null,
          userPermissions: [],
          permissionsLoaded: false,
          failedAttempts: 0,
          remainingAttempts: RATE_LIMIT.MAX_ATTEMPTS,
          isLocked: false,
          lockTimeRemaining: 0,
          isRateLimited: false,
          rateLimitRetryAfter: 0,
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
   7. Exports & Selectors
========================= */

export const { 
  clearError, 
  resetRegistrationSuccess, 
  resetLoginSuccess,
  resetVerificationState,
  logoutLocal, 
  updateUserEmail,
  setUserPermissions,
  clearProfilePictureCache,
  updateToken,
  updateLockTimer,
  setRateLimited,
  clearRateLimited,
  setRemainingAttempts,
  resetRateLimit,
} = authSlice.actions;

// Enhanced selectors
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectUserPermissions = (state) => state.auth.userPermissions;
// NEW: use this to know whether userPermissions reflects a real check yet.
// Any component that renders an "Access Denied" state based on permissions
// MUST check this first — an empty/false permission result before this flag
// is true just means "we don't know yet", not "denied".
export const selectPermissionsLoaded = (state) => state.auth.permissionsLoaded;
export const selectProfilePicture = (state) => state.auth.profilePicture;
export const selectProfilePictureChecked = (state) => state.auth.profilePictureChecked;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectIsAuthChecking = (state) => state.auth.isAuthChecking;
export const selectIsUploading = (state) => state.auth.isUploading;
export const selectIsDeleting = (state) => state.auth.isDeleting;
export const selectAuthError = (state) => state.auth.error;
export const selectFieldErrors = (state) => state.auth.fieldErrors;
export const selectVerificationEmailSent = (state) => state.auth.verificationEmailSent;
export const selectPendingVerificationEmail = (state) => state.auth.pendingVerificationEmail;
export const selectTokenExpiration = (state) => state.auth.tokenExpiration;
export const selectIsTokenExpired = (state) => {
  const exp = state.auth.tokenExpiration;
  return exp ? exp < Date.now() : true;
};

// Rate limiting selectors
export const selectFailedAttempts = (state) => state.auth.failedAttempts;
export const selectRemainingAttempts = (state) => state.auth.remainingAttempts;
export const selectIsLocked = (state) => state.auth.isLocked;
export const selectLockTimeRemaining = (state) => state.auth.lockTimeRemaining;
export const selectIsRateLimited = (state) => state.auth.isRateLimited;
export const selectRateLimitRetryAfter = (state) => state.auth.rateLimitRetryAfter;
export const selectLastAttemptTime = (state) => state.auth.lastAttemptTime;

// Combined auth status selector
export const selectAuthStatus = (state) => {
  const auth = state.auth;
  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    isAuthChecking: auth.isAuthChecking,
    isLocked: auth.isLocked,
    isRateLimited: auth.isRateLimited,
    hasError: !!auth.error,
    error: auth.error,
    remainingAttempts: auth.remainingAttempts,
    lockTimeRemaining: auth.lockTimeRemaining,
    rateLimitRetryAfter: auth.rateLimitRetryAfter,
  };
};

export default authSlice.reducer;