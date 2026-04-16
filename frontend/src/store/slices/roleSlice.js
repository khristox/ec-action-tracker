// src/store/slices/roleSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/roles/');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const createRole = createAsyncThunk(
  'roles/createRole',
  async (roleData, { rejectWithValue }) => {
    try {
      const response = await api.post('/roles/', roleData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateRole = createAsyncThunk(
  'roles/updateRole',
  async ({ id, ...data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/roles/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const deleteRole = createAsyncThunk(
  'roles/deleteRole',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/roles/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchPermissions = createAsyncThunk(
  'roles/fetchPermissions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/permissions/');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const assignPermissions = createAsyncThunk(
  'roles/assignPermissions',
  async ({ role_id, permission_ids }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/roles/${role_id}/permissions`, {
        permission_ids
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const initialState = {
  roles: [],
  permissions: [],
  isLoading: false,
  error: null,
};

const roleSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    clearRoleError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch roles
      .addCase(fetchRoles.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.isLoading = false;
        state.roles = action.payload;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create role
      .addCase(createRole.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createRole.fulfilled, (state, action) => {
        state.isLoading = false;
        state.roles.push(action.payload);
      })
      .addCase(createRole.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update role
      .addCase(updateRole.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateRole.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.roles.findIndex(role => role.id === action.payload.id);
        if (index !== -1) {
          state.roles[index] = action.payload;
        }
      })
      .addCase(updateRole.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete role
      .addCase(deleteRole.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.isLoading = false;
        state.roles = state.roles.filter(role => role.id !== action.payload);
      })
      .addCase(deleteRole.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch permissions
      .addCase(fetchPermissions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.permissions = action.payload;
      })
      .addCase(fetchPermissions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Assign permissions
      .addCase(assignPermissions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(assignPermissions.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.roles.findIndex(role => role.id === action.payload.role_id);
        if (index !== -1) {
          state.roles[index].permissions = action.payload.permissions;
        }
      })
      .addCase(assignPermissions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// ==================== SELECTORS ====================

/**
 * Select all roles from state (this is the one your component is trying to import)
 */
export const selectAllRoles = (state) => state.roles?.roles || [];

/**
 * Select roles loading state
 */
export const selectRolesLoading = (state) => state.roles?.isLoading || false;

/**
 * Select roles error state
 */
export const selectRolesError = (state) => state.roles?.error;

/**
 * Select all permissions from state
 */
export const selectAllPermissions = (state) => state.roles?.permissions || [];

/**
 * Select permissions loading state
 */
export const selectPermissionsLoading = (state) => state.roles?.isLoading || false;

/**
 * Select a specific role by ID
 */
export const selectRoleById = (state, roleId) => {
  const roles = selectAllRoles(state);
  return roles.find(role => role.id === roleId) || null;
};

/**
 * Select permissions for a specific role
 */
export const selectRolePermissions = (state, roleId) => {
  const role = selectRoleById(state, roleId);
  return role?.permissions || [];
};

/**
 * Check if roles are being loaded (alias)
 */
export const selectIsRolesLoading = (state) => state.roles?.isLoading || false;

/**
 * Check if roles have any data
 */
export const selectHasRoles = (state) => {
  const roles = selectAllRoles(state);
  return roles.length > 0;
};

/**
 * Get total count of roles
 */
export const selectRolesCount = (state) => {
  const roles = selectAllRoles(state);
  return roles.length;
};

/**
 * Search roles by name or code
 */
export const selectRolesSearch = (state, searchTerm) => {
  const roles = selectAllRoles(state);
  if (!searchTerm) return roles;
  
  const term = searchTerm.toLowerCase();
  return roles.filter(role => 
    role.name?.toLowerCase().includes(term) ||
    role.code?.toLowerCase().includes(term) ||
    role.description?.toLowerCase().includes(term)
  );
};

/**
 * Get paginated roles
 */
export const selectPaginatedRoles = (state, page = 1, pageSize = 10) => {
  const roles = selectAllRoles(state);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    data: roles.slice(start, end),
    total: roles.length,
    page,
    pageSize,
    totalPages: Math.ceil(roles.length / pageSize)
  };
};

export const { clearRoleError } = roleSlice.actions;
export default roleSlice.reducer;