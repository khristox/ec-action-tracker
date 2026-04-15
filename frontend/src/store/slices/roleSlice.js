import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../api/apiClient';

// Helper function to handle errors
const handleError = (error) => {
  const message = error.response?.data?.detail || error.response?.data?.message || error.message;
  const status = error.response?.status;
  return { message, status };
};

// Fetch all roles - GET /api/v1/roles/
export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return rejectWithValue({ message: 'No authentication token found' });
      }
      
      console.log('Fetching roles from API...');
      const response = await apiClient.get('/roles/');  // Note the trailing slash
      console.log('Roles fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Fetch roles error:', error.response?.data || error.message);
      return rejectWithValue(handleError(error));
    }
  }
);

// Fetch all permissions
export const fetchPermissions = createAsyncThunk(
  'roles/fetchPermissions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/permissions/');
      return response.data;
    } catch (error) {
      return rejectWithValue(handleError(error));
    }
  }
);

// Create a new role
export const createRole = createAsyncThunk(
  'roles/createRole',
  async (roleData, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/roles/', roleData);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleError(error));
    }
  }
);

// Update a role
export const updateRole = createAsyncThunk(
  'roles/updateRole',
  async ({ id, ...roleData }, { rejectWithValue }) => {
    try {
      const response = await apiClient.put(`/roles/${id}`, roleData);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleError(error));
    }
  }
);

// Delete a role
export const deleteRole = createAsyncThunk(
  'roles/deleteRole',
  async (id, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/roles/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(handleError(error));
    }
  }
);

// Assign permissions to a role
export const assignPermissionsToRole = createAsyncThunk(
  'roles/assignPermissionsToRole',
  async ({ role_id, permission_ids }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(`/roles/${role_id}/permissions`, {
        permission_ids,
      });
      return { role_id, permissions: response.data };
    } catch (error) {
      return rejectWithValue(handleError(error));
    }
  }
);

// Remove permission from role
export const removePermissionFromRole = createAsyncThunk(
  'roles/removePermissionFromRole',
  async ({ role_id, permission_id }, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/roles/${role_id}/permissions/${permission_id}`);
      return { role_id, permission_id };
    } catch (error) {
      return rejectWithValue(handleError(error));
    }
  }
);

const initialState = {
  roles: [],
  permissions: [],
  selectedRole: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  successMessage: null,
};

const roleSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    clearRoleError: (state) => {
      state.error = null;
    },
    clearRoleSuccess: (state) => {
      state.successMessage = null;
    },
    setSelectedRole: (state, action) => {
      state.selectedRole = action.payload;
    },
    clearSelectedRole: (state) => {
      state.selectedRole = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Roles
      .addCase(fetchRoles.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.isLoading = false;
        state.roles = action.payload;
        console.log('Roles loaded in store:', state.roles);
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to fetch roles';
        console.error('Fetch roles rejected:', state.error);
      })

      // Fetch Permissions
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
        state.error = action.payload?.message || 'Failed to fetch permissions';
      })

      // Create Role
      .addCase(createRole.pending, (state) => {
        state.isCreating = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(createRole.fulfilled, (state, action) => {
        state.isCreating = false;
        state.roles.push(action.payload);
        state.successMessage = 'Role created successfully';
      })
      .addCase(createRole.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload?.message || 'Failed to create role';
      })

      // Update Role
      .addCase(updateRole.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(updateRole.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.roles.findIndex(role => role.id === action.payload.id);
        if (index !== -1) {
          state.roles[index] = action.payload;
        }
        if (state.selectedRole?.id === action.payload.id) {
          state.selectedRole = action.payload;
        }
        state.successMessage = 'Role updated successfully';
      })
      .addCase(updateRole.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload?.message || 'Failed to update role';
      })

      // Delete Role
      .addCase(deleteRole.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.roles = state.roles.filter(role => role.id !== action.payload);
        if (state.selectedRole?.id === action.payload) {
          state.selectedRole = null;
        }
        state.successMessage = 'Role deleted successfully';
      })
      .addCase(deleteRole.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload?.message || 'Failed to delete role';
      })

      // Assign Permissions
      .addCase(assignPermissionsToRole.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(assignPermissionsToRole.fulfilled, (state, action) => {
        state.isUpdating = false;
        const roleIndex = state.roles.findIndex(role => role.id === action.payload.role_id);
        if (roleIndex !== -1 && state.roles[roleIndex]) {
          state.roles[roleIndex].permissions = action.payload.permissions;
        }
        if (state.selectedRole?.id === action.payload.role_id) {
          state.selectedRole.permissions = action.payload.permissions;
        }
        state.successMessage = 'Permissions assigned successfully';
      })
      .addCase(assignPermissionsToRole.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload?.message || 'Failed to assign permissions';
      })

      // Remove Permission
      .addCase(removePermissionFromRole.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(removePermissionFromRole.fulfilled, (state, action) => {
        state.isUpdating = false;
        const roleIndex = state.roles.findIndex(role => role.id === action.payload.role_id);
        if (roleIndex !== -1 && state.roles[roleIndex]?.permissions) {
          state.roles[roleIndex].permissions = state.roles[roleIndex].permissions.filter(
            p => p.id !== action.payload.permission_id
          );
        }
        if (state.selectedRole?.id === action.payload.role_id && state.selectedRole.permissions) {
          state.selectedRole.permissions = state.selectedRole.permissions.filter(
            p => p.id !== action.payload.permission_id
          );
        }
        state.successMessage = 'Permission removed successfully';
      })
      .addCase(removePermissionFromRole.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload?.message || 'Failed to remove permission';
      });
  },
});

// Selectors
export const selectAllRoles = (state) => state.roles.roles;
export const selectAllPermissions = (state) => state.roles.permissions;
export const selectSelectedRole = (state) => state.roles.selectedRole;
export const selectRolesLoading = (state) => state.roles.isLoading;
export const selectRolesCreating = (state) => state.roles.isCreating;
export const selectRolesUpdating = (state) => state.roles.isUpdating;
export const selectRolesDeleting = (state) => state.roles.isDeleting;
export const selectRolesError = (state) => state.roles.error;
export const selectRolesSuccess = (state) => state.roles.successMessage;

export const { 
  clearRoleError, 
  clearRoleSuccess, 
  setSelectedRole, 
  clearSelectedRole 
} = roleSlice.actions;

export default roleSlice.reducer;