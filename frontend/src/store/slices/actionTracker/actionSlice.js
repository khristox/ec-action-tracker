// src/store/slices/actionTracker/actionSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// UUID Validator
const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ====================== ASYNC THUNKS ======================

export const fetchMyTasks = createAsyncThunk(
  'actions/fetchMyTasks',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { page = 1, limit = 10, search = '', status = null, priority = null } = params;

      const queryParams = { skip: (page - 1) * limit, limit };

      if (search?.trim()) queryParams.search = search.trim();
      if (status && status !== 'all') {
        if (status === 'overdue') queryParams.is_overdue = true;
        else if (status === 'completed') queryParams.include_completed = true;
        else queryParams.status = status;
      }
      if (priority && priority !== 'all') {
        queryParams.priority = parseInt(priority);
      }

      const response = await api.get('/action-tracker/actions/my-tasks', { params: queryParams });

      const data = response.data.data || response.data || [];
      const items = Array.isArray(data) ? data : (data.items || []);
      const total = Array.isArray(data) ? data.length : (data.total || items.length);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('fetchMyTasks error:', error);
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch my tasks');
    }
  }
);

export const fetchActionById = createAsyncThunk(
  'actions/fetchActionById',
  async (actionId, { rejectWithValue }) => {
    if (!isValidUUID(actionId)) {
      return rejectWithValue('Invalid task ID format');
    }

    try {
      const response = await api.get(`/action-tracker/actions/${actionId}`);
      return response.data;
    } catch (error) {
      console.error('fetchActionById failed:', error.response?.data || error);
      if (error.response?.status === 404) return rejectWithValue('Task not found');
      if (error.response?.status === 403) return rejectWithValue('Permission denied');
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch task');
    }
  }
);


export const updateAction = createAsyncThunk(
  'actions/updateAction',
  async ({ id, data }, { rejectWithValue }) => {
    if (!isValidUUID(id)) return rejectWithValue('Invalid task ID format');
    
    try {
      const response = await api.put(`/action-tracker/actions/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update action');
    }
  }
);

export const updateActionProgress = createAsyncThunk(
  'actions/updateActionProgress',
  async ({ id, progressData }, { rejectWithValue }) => {
    if (!isValidUUID(id)) return rejectWithValue('Invalid task ID format');

    try {
      const payload = {
        progress_percentage: progressData.progress_percentage,
        individual_status_id: progressData.individual_status_id,
        remarks: progressData.remarks || `Progress updated to ${progressData.progress_percentage}%`,
      };

      const response = await api.post(`/action-tracker/actions/${id}/progress`, payload);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update progress');
    }
  }
);

export const addActionComment = createAsyncThunk(
  'actions/addActionComment',
  async ({ id, commentData }, { rejectWithValue }) => {
    if (!isValidUUID(id)) return rejectWithValue('Invalid task ID format');

    try {
      const response = await api.post(`/action-tracker/actions/${id}/comments`, commentData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to add comment');
    }
  }
);

export const fetchAllActions = createAsyncThunk(
  'actions/fetchAllActions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/actions', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch actions');
    }
  }
);

export const fetchActionComments = createAsyncThunk(
  'actions/fetchActionComments',
  async ({ id, skip = 0, limit = 50 }, { rejectWithValue }) => {
    if (!isValidUUID(id)) return rejectWithValue('Invalid task ID format');
    try {
      const response = await api.get(`/action-tracker/actions/${id}/comments`, { params: { skip, limit } });
      return { actionId: id, comments: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch comments');
    }
  }
);

export const fetchActionHistory = createAsyncThunk(
  'actions/fetchActionHistory',
  async ({ id, skip = 0, limit = 50 }, { rejectWithValue }) => {
    if (!isValidUUID(id)) return rejectWithValue('Invalid task ID format');
    try {
      const response = await api.get(`/action-tracker/actions/${id}/history`, { params: { skip, limit } });
      return { actionId: id, history: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch history');
    }
  }
);

// ====================== INITIAL STATE ======================

const initialState = {
  myTasks: { items: [], total: 0, page: 1, limit: 10, totalPages: 1 },
  allActions: { items: [], total: 0, page: 1, limit: 10, totalPages: 1 },
  currentAction: null,
  loading: false,
  updatingProgress: false,
  error: null,
  success: false,
  // Filter state
  filters: {
    search: '',
    status: '',
    priority: '',
  },
  page: 1,
  limit: 10,
};

// ====================== SLICE ======================

const actionSlice = createSlice({
  name: 'actions',
  initialState,
  reducers: {
    clearError: (state) => { 
      state.error = null; 
    },
    clearSuccess: (state) => { 
      state.success = false; 
    },
    clearCurrentAction: (state) => { 
      state.currentAction = null; 
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.page = 1;
    },
    setSearchFilter: (state, action) => {
      state.filters.search = action.payload;
      state.page = 1;
    },
    setStatusFilter: (state, action) => {
      state.filters.status = action.payload;
      state.page = 1;
    },
    setPriorityFilter: (state, action) => {
      state.filters.priority = action.payload;
      state.page = 1;
    },
    resetFilters: (state) => {
      state.filters = {
        search: '',
        status: '',
        priority: '',
      };
      state.page = 1;
    },
    setPage: (state, action) => {
      state.page = action.payload;
    },
    setLimit: (state, action) => {
      state.limit = action.payload;
      state.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAction.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.currentAction = action.payload;
        // Update in list if exists
        const index = state.myTasks.items.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.myTasks.items[index] = action.payload;
        }
      })
      .addCase(updateAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch My Tasks
      .addCase(fetchMyTasks.pending, (state) => { 
        state.loading = true; 
        state.error = null; 
      })
      .addCase(fetchMyTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.myTasks = action.payload;
      })
      .addCase(fetchMyTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Single Action
      .addCase(fetchActionById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActionById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentAction = action.payload;
      })
      .addCase(fetchActionById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.currentAction = null;
      })

      // Update Progress
      .addCase(updateActionProgress.pending, (state) => {
        state.updatingProgress = true;
        state.error = null;
      })
      .addCase(updateActionProgress.fulfilled, (state, action) => {
        state.updatingProgress = false;
        state.success = true;
        if (state.currentAction?.id === action.meta.arg.id) {
          state.currentAction = action.payload;
        }
      })
      .addCase(updateActionProgress.rejected, (state, action) => {
        state.updatingProgress = false;
        state.error = action.payload;
      })

      // Add Comment
      .addCase(addActionComment.fulfilled, (state) => {
        state.success = true;
      })
      .addCase(addActionComment.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Fetch All Actions
      .addCase(fetchAllActions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllActions.fulfilled, (state, action) => {
        state.loading = false;
        const data = action.payload.data || action.payload || [];
        const items = Array.isArray(data) ? data : (data.items || []);
        const total = Array.isArray(data) ? data.length : (data.total || items.length);
        state.allActions = {
          items,
          total,
          page: state.page,
          limit: state.limit,
          totalPages: Math.ceil(total / state.limit),
        };
      })
      .addCase(fetchAllActions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

// ====================== EXPORT ACTIONS ======================

export const { 
  clearError, 
  clearSuccess, 
  clearCurrentAction,
  setFilters,
  setSearchFilter,
  setStatusFilter,
  setPriorityFilter,
  resetFilters,
  setPage,
  setLimit,
} = actionSlice.actions;

// ====================== SELECTORS ======================

export const selectMyTasks = (state) => state.actions.myTasks;
export const selectAllActions = (state) => state.actions.allActions;
export const selectCurrentAction = (state) => state.actions.currentAction;
export const selectActionsLoading = (state) => state.actions.loading;
export const selectActionsError = (state) => state.actions.error;
export const selectActionsSuccess = (state) => state.actions.success;
export const selectUpdatingProgress = (state) => state.actions.updatingProgress;
export const selectActionFilters = (state) => state.actions.filters;
export const selectActionPage = (state) => state.actions.page;
export const selectActionLimit = (state) => state.actions.limit;

// ====================== DEFAULT EXPORT ======================

export default actionSlice.reducer;