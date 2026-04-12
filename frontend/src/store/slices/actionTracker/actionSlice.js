// src/store/slices/actionTracker/actionsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// Helper to validate UUID
const isValidUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Async Thunks
export const fetchMyTasks = createAsyncThunk(
  'actions/fetchMyTasks',
  async ({ page = 1, limit = 10, search = '', status = 'all', priority = 'all', sortBy = 'due_date', sortOrder = 'asc' } = {}, { rejectWithValue }) => {
    try {
      const params = {
        page,
        limit,
        search: search || undefined,
        status: status !== 'all' ? status : undefined,
        priority: priority !== 'all' ? priority : undefined,
        sort_by: sortBy,
        sort_order: sortOrder
      };
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      const response = await api.get('/action-tracker/actions/my-tasks', { params });
      const data = response.data;
      
      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        return {
          items: data,
          total: data.length,
          page,
          limit,
          totalPages: Math.ceil(data.length / limit)
        };
      }
      return {
        items: data.items || [],
        total: data.total || 0,
        page,
        limit,
        totalPages: Math.ceil((data.total || 0) / limit)
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to fetch tasks');
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
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to fetch actions');
    }
  }
);

export const fetchActionById = createAsyncThunk(
  'actions/fetchActionById',
  async (actionId, { rejectWithValue }) => {
    // Validate UUID before making request
    if (!isValidUUID(actionId)) {
      return rejectWithValue('Invalid task ID format');
    }
    
    try {
      const response = await api.get(`/action-tracker/actions/${actionId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return rejectWithValue('Task not found');
      }
      if (error.response?.status === 403) {
        return rejectWithValue('You do not have permission to view this task');
      }
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to fetch task');
    }
  }
);

export const updateActionProgress = createAsyncThunk(
  'actions/updateActionProgress',
  async ({ id, progressData }, { rejectWithValue }) => {
    // Validate UUID
    if (!isValidUUID(id)) {
      return rejectWithValue('Invalid task ID format');
    }
    
    try {
      // Ensure the payload structure matches backend expectations
      const payload = {
        progress_percentage: progressData.progress_percentage,
        individual_status_id: progressData.individual_status_id,
        remarks: progressData.remarks || `Progress updated to ${progressData.progress_percentage}%`
      };
      
      console.log('Sending progress update to backend:', payload);
      const response = await api.post(`/action-tracker/actions/${id}/progress`, payload);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to update progress');
    }
  }
);

export const addActionComment = createAsyncThunk(
  'actions/addActionComment',
  async ({ id, commentData }, { rejectWithValue }) => {
    if (!isValidUUID(id)) {
      return rejectWithValue('Invalid task ID format');
    }
    
    try {
      const response = await api.post(`/action-tracker/actions/${id}/comments`, commentData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to add comment');
    }
  }
);

export const fetchActionComments = createAsyncThunk(
  'actions/fetchActionComments',
  async ({ id, skip = 0, limit = 50 }, { rejectWithValue }) => {
    if (!isValidUUID(id)) {
      return rejectWithValue('Invalid task ID format');
    }
    
    try {
      const response = await api.get(`/action-tracker/actions/${id}/comments`, {
        params: { skip, limit }
      });
      return { actionId: id, comments: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to fetch comments');
    }
  }
);

export const fetchActionHistory = createAsyncThunk(
  'actions/fetchActionHistory',
  async ({ id, skip = 0, limit = 50 }, { rejectWithValue }) => {
    if (!isValidUUID(id)) {
      return rejectWithValue('Invalid task ID format');
    }
    
    try {
      const response = await api.get(`/action-tracker/actions/${id}/history`, {
        params: { skip, limit }
      });
      return { actionId: id, history: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to fetch history');
    }
  }
);

export const createAction = createAsyncThunk(
  'actions/createAction',
  async ({ minuteId, actionData }, { rejectWithValue }) => {
    if (!isValidUUID(minuteId)) {
      return rejectWithValue('Invalid minute ID format');
    }
    
    try {
      const response = await api.post(`/action-tracker/minutes/${minuteId}/actions`, actionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to create action');
    }
  }
);

export const updateAction = createAsyncThunk(
  'actions/updateAction',
  async ({ id, actionData }, { rejectWithValue }) => {
    if (!isValidUUID(id)) {
      return rejectWithValue('Invalid task ID format');
    }
    
    try {
      const response = await api.put(`/action-tracker/actions/${id}`, actionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to update action');
    }
  }
);

export const deleteAction = createAsyncThunk(
  'actions/deleteAction',
  async (id, { rejectWithValue }) => {
    if (!isValidUUID(id)) {
      return rejectWithValue('Invalid task ID format');
    }
    
    try {
      await api.delete(`/action-tracker/actions/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message || 'Failed to delete action');
    }
  }
);

// Initial state
const initialState = {
  myTasks: {
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  },
  allActions: [],
  currentAction: null,
  loading: false,
  error: null,
  updatingProgress: false,
  filters: {
    search: '',
    status: 'all',
    priority: 'all',
    sortBy: 'due_date',
    sortOrder: 'asc'
  },
  comments: {},
  history: {},
  actionStatuses: []
};

const actionSlice = createSlice({
  name: 'actions',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    setCurrentAction: (state, action) => {
      state.currentAction = action.payload;
    },
    clearCurrentAction: (state) => {
      state.currentAction = null;
      state.error = null;
    },
    clearComments: (state, action) => {
      if (action.payload) {
        delete state.comments[action.payload];
      } else {
        state.comments = {};
      }
    },
    clearHistory: (state, action) => {
      if (action.payload) {
        delete state.history[action.payload];
      } else {
        state.history = {};
      }
    },
    setActionStatuses: (state, action) => {
      state.actionStatuses = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch My Tasks
      .addCase(fetchMyTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.myTasks = action.payload;
        state.error = null;
      })
      .addCase(fetchMyTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      
      // Fetch All Actions
      .addCase(fetchAllActions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllActions.fulfilled, (state, action) => {
        state.loading = false;
        state.allActions = Array.isArray(action.payload) ? action.payload : action.payload.items || [];
        state.error = null;
      })
      .addCase(fetchAllActions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      
      // Fetch Action By ID
      .addCase(fetchActionById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActionById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentAction = action.payload;
        state.error = null;
      })
      .addCase(fetchActionById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
        state.currentAction = null;
      })
      
      // Update Action Progress
      .addCase(updateActionProgress.pending, (state) => {
        state.updatingProgress = true;
        state.error = null;
      })
      .addCase(updateActionProgress.fulfilled, (state, action) => {
        state.updatingProgress = false;
        // Update in myTasks
        const index = state.myTasks.items.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.myTasks.items[index] = action.payload;
        }
        // Update in allActions
        const allIndex = state.allActions.findIndex(a => a.id === action.payload.id);
        if (allIndex !== -1) {
          state.allActions[allIndex] = action.payload;
        }
        // Update currentAction
        if (state.currentAction?.id === action.payload.id) {
          state.currentAction = action.payload;
        }
        state.error = null;
      })
      .addCase(updateActionProgress.rejected, (state, action) => {
        state.updatingProgress = false;
        state.error = action.payload || action.error.message;
      })
      
      // Fetch Action Comments
      .addCase(fetchActionComments.fulfilled, (state, action) => {
        state.comments[action.payload.actionId] = action.payload.comments;
      })
      .addCase(fetchActionComments.rejected, (state, action) => {
        console.error('Failed to fetch comments:', action.payload);
      })
      
      // Fetch Action History
      .addCase(fetchActionHistory.fulfilled, (state, action) => {
        state.history[action.payload.actionId] = action.payload.history;
      })
      .addCase(fetchActionHistory.rejected, (state, action) => {
        console.error('Failed to fetch history:', action.payload);
      })
      
      // Add Action Comment
      .addCase(addActionComment.fulfilled, (state, action) => {
        const actionId = action.payload.action_id;
        if (state.comments[actionId]) {
          state.comments[actionId] = [action.payload, ...state.comments[actionId]];
        } else {
          state.comments[actionId] = [action.payload];
        }
        state.error = null;
      })
      .addCase(addActionComment.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      
      // Create Action
      .addCase(createAction.fulfilled, (state, action) => {
        if (Array.isArray(state.allActions)) {
          state.allActions.unshift(action.payload);
        }
        state.error = null;
      })
      .addCase(createAction.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      
      // Update Action
      .addCase(updateAction.fulfilled, (state, action) => {
        const index = state.myTasks.items.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.myTasks.items[index] = action.payload;
        }
        const allIndex = state.allActions.findIndex(a => a.id === action.payload.id);
        if (allIndex !== -1) {
          state.allActions[allIndex] = action.payload;
        }
        if (state.currentAction?.id === action.payload.id) {
          state.currentAction = action.payload;
        }
        state.error = null;
      })
      .addCase(updateAction.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      
      // Delete Action
      .addCase(deleteAction.fulfilled, (state, action) => {
        state.myTasks.items = state.myTasks.items.filter(t => t.id !== action.payload);
        state.allActions = state.allActions.filter(a => a.id !== action.payload);
        if (state.currentAction?.id === action.payload) {
          state.currentAction = null;
        }
        // Clean up comments and history
        delete state.comments[action.payload];
        delete state.history[action.payload];
        state.error = null;
      })
      .addCase(deleteAction.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      });
  },
});

export const { 
  clearError, 
  setFilters, 
  resetFilters, 
  setCurrentAction, 
  clearCurrentAction,
  clearComments,
  clearHistory,
  setActionStatuses
} = actionSlice.actions;

export default actionSlice.reducer;