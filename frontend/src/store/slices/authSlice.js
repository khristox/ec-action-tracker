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

  if (responseData?.error) {
    const errorMsg = responseData.error.message;
    if (typeof errorMsg === 'object' && errorMsg !== null) {
      message = errorMsg.message || 'Validation error';
      if (errorMsg.field) fieldErrors[errorMsg.field] = message;
    } else {
      message = errorMsg || message;
    }
    status = responseData.error.code || status;
  } 
  else if (responseData?.detail && Array.isArray(responseData.detail)) {
    message = responseData.detail[0]?.msg || 'Validation failed';
    responseData.detail.forEach(detail => {
      if (detail.loc && detail.msg) {
        const field = detail.loc[detail.loc.length - 1];
        fieldErrors[field] = detail.msg;
      }
    });
  }
  else if (!err.response) {
    message = "Incorrect username or password";
    status = 401;
  }

  return { message: String(message), fieldErrors, status };
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
   2. Async Thunks
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
      } catch {
        clearAuthStorage();
        return rejectWithValue(null);
      }
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      // Instant UI response
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
   3. Slice Definition
========================= */

const initialState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false, // Unified loading state
  isAuthChecking: false,
  registrationSuccess: false,
  error: null,
  fieldErrors: {},
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.fieldErrors = {};
    },
    resetRegistrationSuccess: (state) => {
      state.registrationSuccess = false;
    },
    logoutLocal: (state) => {
      clearAuthStorage();
      return { ...initialState, user: null, token: null, isAuthenticated: false };
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
      // Check Auth specific loading
      .addCase(checkAuth.pending, (state) => { state.isAuthChecking = true; })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isAuthChecking = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isAuthChecking = false;
        state.isAuthenticated = false;
        state.user = null;
      })
      
      // Login/Register results
      .addCase(login.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.token = action.payload.access_token;
        state.user = action.payload.user || action.payload;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.registrationSuccess = true;
        if (action.payload) state.user = action.payload;
      })

      // Global logout handling
      .addCase(logout.fulfilled, (state) => {
        return { ...initialState, user: null, token: null, isAuthenticated: false };
      })

      // MATCHERS for cleaner code
      // Match any "pending" action except checkAuth
      .addMatcher(
        (action) => action.type.endsWith('/pending') && !action.type.includes('checkAuth'),
        (state) => {
          state.isLoading = true;
          state.error = null;
          state.fieldErrors = {};
        }
      )
      // Match any "fulfilled" or "rejected" to turn off loading
      .addMatcher(
        (action) => action.type.endsWith('/fulfilled') || action.type.endsWith('/rejected'),
        (state) => { state.isLoading = false; }
      )
      // Match any "rejected" to extract error info
      .addMatcher(
        (action) => action.type.endsWith('/rejected') && action.payload,
        (state, action) => {
          state.error = action.payload;
          state.fieldErrors = action.payload.fieldErrors || {};
        }
      );
  },
});

/* =========================
   4. Exports & Selectors
========================= */

export const { clearError, resetRegistrationSuccess, logoutLocal, updateUserEmail } = authSlice.actions;

export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectIsAuthChecking = (state) => state.auth.isAuthChecking;

// Default export
export default authSlice.reducer;