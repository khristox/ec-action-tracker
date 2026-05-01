import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../api/apiClient';

// Fetch all users (admin only)
export const fetchUsers = createAsyncThunk(
  'admin/fetchUsers',
  async ({ page = 1, limit = 10, search = '', is_active = null, role = null, is_superuser = null }, { rejectWithValue }) => {
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (is_active !== null) params.is_active = is_active;
      if (role) params.role = role;
      if (is_superuser !== null) params.is_superuser = is_superuser; // Add this
      
      const response = await apiClient.get('/admin/users', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update the updateUserRoles thunk
export const updateUserRoles = createAsyncThunk(
  'admin/updateUserRoles',
  async ({ id, roles }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return rejectWithValue({ message: 'No authentication token found' });
      }

      const requestData = roles;
      
      const response = await apiClient.put(`/admin/users/${id}/roles`, requestData);
      return response.data;
    } catch (err) {
      console.error('Update user roles error - Full details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        detail: err.response?.data?.detail,
        message: err.message
      });
      
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          err.response.data.detail.forEach((item, index) => {
            console.error(`Validation error ${index + 1}:`, item);
          });
        } else {
          console.error('Validation error:', err.response.data.detail);
        }
      }
      
      return rejectWithValue(err.response?.data || { message: 'Failed to update user roles' });
    }
  }
);

// Create new user (admin only)
export const createUser = createAsyncThunk(
  'admin/createUser',
  async (userData, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return rejectWithValue({ message: 'No authentication token found' });
      }

      const createData = {
        email: userData.email,
        username: userData.username,
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        phone: userData.phone || '',
        password: userData.password,
        roles: userData.roles || ['user'],
        is_active: userData.is_active !== undefined ? userData.is_active : true,
        is_verified: userData.is_verified !== undefined ? userData.is_verified : false,
        is_superuser: userData.is_superuser || false, // Add this
      };

      const response = await apiClient.post('/admin/users', createData);
      return response.data;
    } catch (err) {
      console.error('Create user error:', err.response?.data);
      return rejectWithValue(err.response?.data || { message: 'Failed to create user' });
    }
  }
);

// Update user (admin only) - FIXED to include is_superuser
export const updateUser = createAsyncThunk(
  'admin/updateUser',
  async ({ id, ...userData }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return rejectWithValue({ message: 'No authentication token found' });
      }

      // Clean up the data
      const cleanData = {};
      Object.keys(userData).forEach(key => {
        if (userData[key] !== undefined && userData[key] !== null && userData[key] !== '') {
          if (key === 'is_active' || key === 'is_verified' || key === 'is_superuser') {
            cleanData[key] = Boolean(userData[key]);
          } else {
            cleanData[key] = userData[key];
          }
        }
      });

      console.log('Update user data being sent:', cleanData);
      
      const response = await apiClient.put(`/admin/users/${id}`, cleanData);
      console.log('Update user response:', response.data);
      return response.data;
    } catch (err) {
      console.error('Update user error - Full response:', {
        status: err.response?.status,
        data: err.response?.data,
        id: id
      });
      return rejectWithValue(err.response?.data || { message: 'Failed to update user' });
    }
  }
);

// Delete user (admin only)
export const deleteUser = createAsyncThunk(
  'admin/deleteUser',
  async (id, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/admin/users/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Reset user password (admin only)
export const resetUserPassword = createAsyncThunk(
  'admin/resetUserPassword',
  async ({ user_id, new_password }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(`/admin/users/${user_id}/reset-password`, { new_password });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const initialState = {
  users: [],
  total: 0,
  isLoading: false,
  error: null,
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearAdminError: (state) => {
      state.error = null;
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
        state.total = action.payload.total || action.payload.length;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Create User
      .addCase(createUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(createUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Update User
      .addCase(updateUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Delete User
      .addCase(deleteUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Reset Password
      .addCase(resetUserPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resetUserPassword.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(resetUserPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearAdminError } = adminSlice.actions;
export default adminSlice.reducer;