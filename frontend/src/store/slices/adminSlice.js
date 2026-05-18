import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../api/apiClient';

// Helper function to extract error messages from validation errors
const extractErrorMessage = (error) => {
  // Handle 422 validation errors
  if (error.response?.status === 422 && error.response?.data?.detail) {
    const detail = error.response.data.detail;
    
    if (Array.isArray(detail)) {
      // Extract all error messages and group by field
      const fieldErrors = {};
      const generalErrors = [];
      
      detail.forEach(err => {
        const message = err.msg;
        if (err.loc && err.loc.length > 1) {
          const fieldName = err.loc[err.loc.length - 1];
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = [];
          }
          fieldErrors[fieldName].push(message);
        } else {
          generalErrors.push(message);
        }
      });
      
      return {
        message: generalErrors.join(', ') || 'Validation failed',
        fieldErrors,
        status: 422,
        raw: detail
      };
    }
    
    return {
      message: typeof detail === 'string' ? detail : 'Validation failed',
      fieldErrors: {},
      status: 422,
      raw: detail
    };
  }
  
  // Handle other error responses
  if (error.response?.data) {
    const data = error.response.data;
    return {
      message: data.message || data.detail || data.error || 'An error occurred',
      fieldErrors: {},
      status: error.response.status,
      raw: data
    };
  }
  
  // Handle network errors
  if (error.request) {
    return {
      message: 'Network error: Unable to connect to server',
      fieldErrors: {},
      status: null,
      raw: null
    };
  }
  
  // Handle other errors
  return {
    message: error.message || 'An unexpected error occurred',
    fieldErrors: {},
    status: null,
    raw: error
  };
};

// Helper to ensure auth token exists
const ensureToken = (rejectWithValue) => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return rejectWithValue({
      message: 'No authentication token found. Please login again.',
      fieldErrors: {},
      status: 401
    });
  }
  return token;
};

// Fetch all users (admin only)
export const fetchUsers = createAsyncThunk(
  'admin/fetchUsers',
  async ({ page = 1, limit = 10, search = '', is_active = null, role = null, is_superuser = null }, { rejectWithValue }) => {
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (is_active !== null) params.is_active = is_active;
      if (role) params.role = role;
      if (is_superuser !== null) params.is_superuser = is_superuser;
      
      const response = await apiClient.get('/admin/users', { params });
      return response.data;
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Update user roles
export const updateUserRoles = createAsyncThunk(
  'admin/updateUserRoles',
  async ({ id, roles }, { rejectWithValue }) => {
    try {
      const tokenCheck = ensureToken(rejectWithValue);
      if (tokenCheck?.message) return tokenCheck;

      if (!roles || roles.length === 0) {
        return rejectWithValue({
          message: 'At least one role is required',
          fieldErrors: { roles: ['At least one role is required'] },
          status: 422
        });
      }

      const response = await apiClient.put(`/admin/users/${id}/roles`, roles);
      return response.data;
    } catch (error) {
      console.error('Update user roles error:', error.response?.data);
      const errorMessage = extractErrorMessage(error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Create new user (admin only)
export const createUser = createAsyncThunk(
  'admin/createUser',
  async (userData, { rejectWithValue }) => {
    try {
      const tokenCheck = ensureToken(rejectWithValue);
      if (tokenCheck?.message) return tokenCheck;

      // Validate required fields
      if (!userData.email) {
        return rejectWithValue({
          message: 'Email is required',
          fieldErrors: { email: ['Email is required'] },
          status: 422
        });
      }
      
      if (!userData.username) {
        return rejectWithValue({
          message: 'Username is required',
          fieldErrors: { username: ['Username is required'] },
          status: 422
        });
      }
      
      if (!userData.password) {
        return rejectWithValue({
          message: 'Password is required',
          fieldErrors: { password: ['Password is required'] },
          status: 422
        });
      }

      if (!userData.roles || userData.roles.length === 0) {
        return rejectWithValue({
          message: 'At least one role is required',
          fieldErrors: { roles: ['At least one role is required'] },
          status: 422
        });
      }

      const createData = {
        email: userData.email.trim(),
        username: userData.username.trim(),
        first_name: userData.first_name?.trim() || '',
        last_name: userData.last_name?.trim() || '',
        phone: userData.phone?.trim() || '',
        password: userData.password,
        roles: userData.roles,
        is_active: userData.is_active !== undefined ? userData.is_active : true,
        is_verified: userData.is_verified !== undefined ? userData.is_verified : false,
        is_superuser: userData.is_superuser || false,
      };

      const response = await apiClient.post('/admin/users', createData);
      return response.data;
    } catch (error) {
      console.error('Create user error:', error.response?.data);
      const errorMessage = extractErrorMessage(error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Update user (admin only)
export const updateUser = createAsyncThunk(
  'admin/updateUser',
  async ({ id, ...userData }, { rejectWithValue }) => {
    try {
      const tokenCheck = ensureToken(rejectWithValue);
      if (tokenCheck?.message) return tokenCheck;

      // Clean up the data
      const cleanData = {};
      const allowedFields = ['email', 'username', 'first_name', 'last_name', 'phone', 'is_active', 'is_verified', 'is_superuser'];
      
      Object.keys(userData).forEach(key => {
        if (allowedFields.includes(key) && userData[key] !== undefined && userData[key] !== null && userData[key] !== '') {
          if (key === 'is_active' || key === 'is_verified' || key === 'is_superuser') {
            cleanData[key] = Boolean(userData[key]);
          } else if (typeof userData[key] === 'string') {
            cleanData[key] = userData[key].trim();
          } else {
            cleanData[key] = userData[key];
          }
        }
      });

      if (Object.keys(cleanData).length === 0) {
        return rejectWithValue({
          message: 'No valid fields to update',
          fieldErrors: {},
          status: 422
        });
      }

      const response = await apiClient.put(`/admin/users/${id}`, cleanData);
      return response.data;
    } catch (error) {
      console.error('Update user error:', error.response?.data);
      const errorMessage = extractErrorMessage(error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Delete user (admin only)
export const deleteUser = createAsyncThunk(
  'admin/deleteUser',
  async (id, { rejectWithValue }) => {
    try {
      const tokenCheck = ensureToken(rejectWithValue);
      if (tokenCheck?.message) return tokenCheck;

      await apiClient.delete(`/admin/users/${id}`);
      return id;
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Reset user password (admin only)
export const resetUserPassword = createAsyncThunk(
  'admin/resetUserPassword',
  async ({ user_id, new_password }, { rejectWithValue }) => {
    try {
      const tokenCheck = ensureToken(rejectWithValue);
      if (tokenCheck?.message) return tokenCheck;

      if (!new_password || new_password.length < 6) {
        return rejectWithValue({
          message: 'Password must be at least 6 characters long',
          fieldErrors: { new_password: ['Password must be at least 6 characters'] },
          status: 422
        });
      }

      const response = await apiClient.post(`/admin/users/${user_id}/reset-password`, { new_password });
      return response.data;
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Bulk delete users
export const bulkDeleteUsers = createAsyncThunk(
  'admin/bulkDeleteUsers',
  async (userIds, { rejectWithValue }) => {
    try {
      const tokenCheck = ensureToken(rejectWithValue);
      if (tokenCheck?.message) return tokenCheck;

      if (!userIds || userIds.length === 0) {
        return rejectWithValue({
          message: 'No users selected for deletion',
          fieldErrors: {},
          status: 422
        });
      }

      const response = await apiClient.post('/admin/users/bulk-delete', { user_ids: userIds });
      return response.data;
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Bulk update user status
export const bulkUpdateUserStatus = createAsyncThunk(
  'admin/bulkUpdateUserStatus',
  async ({ userIds, is_active }, { rejectWithValue }) => {
    try {
      const tokenCheck = ensureToken(rejectWithValue);
      if (tokenCheck?.message) return tokenCheck;

      if (!userIds || userIds.length === 0) {
        return rejectWithValue({
          message: 'No users selected',
          fieldErrors: {},
          status: 422
        });
      }

      const response = await apiClient.post('/admin/users/bulk-status', { user_ids: userIds, is_active });
      return response.data;
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      return rejectWithValue(errorMessage);
    }
  }
);

const initialState = {
  users: [],
  total: 0,
  isLoading: false,
  error: null,
  lastOperation: null,
  operationSuccess: false,
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearAdminError: (state) => {
      state.error = null;
    },
    clearLastOperation: (state) => {
      state.lastOperation = null;
      state.operationSuccess = false;
    },
    resetAdminState: (state) => {
      state.error = null;
      state.lastOperation = null;
      state.operationSuccess = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Users
      .addCase(fetchUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload.items || action.payload;
        state.total = action.payload.total || (action.payload.items?.length || action.payload.length);
        state.error = null;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Create User
      .addCase(createUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastOperation = 'create';
        state.operationSuccess = false;
      })
      .addCase(createUser.fulfilled, (state) => {
        state.isLoading = false;
        state.operationSuccess = true;
        state.error = null;
      })
      .addCase(createUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.operationSuccess = false;
      })
      
      // Update User
      .addCase(updateUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastOperation = 'update';
        state.operationSuccess = false;
      })
      .addCase(updateUser.fulfilled, (state) => {
        state.isLoading = false;
        state.operationSuccess = true;
        state.error = null;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.operationSuccess = false;
      })
      
      // Update User Roles
      .addCase(updateUserRoles.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastOperation = 'updateRoles';
        state.operationSuccess = false;
      })
      .addCase(updateUserRoles.fulfilled, (state) => {
        state.isLoading = false;
        state.operationSuccess = true;
        state.error = null;
      })
      .addCase(updateUserRoles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.operationSuccess = false;
      })
      
      // Delete User
      .addCase(deleteUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastOperation = 'delete';
        state.operationSuccess = false;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = state.users.filter(user => user.id !== action.payload);
        state.total -= 1;
        state.operationSuccess = true;
        state.error = null;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.operationSuccess = false;
      })
      
      // Reset Password
      .addCase(resetUserPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastOperation = 'resetPassword';
        state.operationSuccess = false;
      })
      .addCase(resetUserPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.operationSuccess = true;
        state.error = null;
      })
      .addCase(resetUserPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.operationSuccess = false;
      })
      
      // Bulk Delete Users
      .addCase(bulkDeleteUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastOperation = 'bulkDelete';
        state.operationSuccess = false;
      })
      .addCase(bulkDeleteUsers.fulfilled, (state) => {
        state.isLoading = false;
        state.operationSuccess = true;
        state.error = null;
      })
      .addCase(bulkDeleteUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.operationSuccess = false;
      })
      
      // Bulk Update Status
      .addCase(bulkUpdateUserStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastOperation = 'bulkStatus';
        state.operationSuccess = false;
      })
      .addCase(bulkUpdateUserStatus.fulfilled, (state) => {
        state.isLoading = false;
        state.operationSuccess = true;
        state.error = null;
      })
      .addCase(bulkUpdateUserStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.operationSuccess = false;
      });
  },
});

export const { clearAdminError, clearLastOperation, resetAdminState } = adminSlice.actions;
export default adminSlice.reducer;