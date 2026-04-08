// src/store/slices/actionTracker/actionsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// Async Thunks
export const fetchMyTasks = createAsyncThunk(
  'actions/fetchMyTasks',
  async ({ page = 1, limit = 10, search = '', status = 'all', priority = 'all', sortBy = 'due_date', sortOrder = 'asc' } = {}) => {
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
  }
);

export const fetchAllActions = createAsyncThunk(
  'actions/fetchAllActions',
  async (params = {}) => {
    const response = await api.get('/action-tracker/actions', { params });
    return response.data;
  }
);

export const fetchActionById = createAsyncThunk(
  'actions/fetchActionById',
  async (actionId) => {
    const response = await api.get(`/action-tracker/actions/${actionId}`);
    return response.data;
  }
);

// frontend/src/store/slices/actionTracker/actionSlice.js

// In your actionSlice.js
export const updateActionProgress = createAsyncThunk(
  'actions/updateActionProgress',
  async ({ id, progressData }) => {
    // Ensure the payload structure matches backend expectations
    const payload = {
      progress_percentage: progressData.progress_percentage,
      individual_status_id: progressData.individual_status_id,
      remarks: progressData.remarks
    };
    
    console.log('Sending progress update to backend:', payload);
    const response = await api.post(`/action-tracker/actions/${id}/progress`, payload);
    return response.data;
  }
);

export const addActionComment = createAsyncThunk(
  'actions/addActionComment',
  async ({ id, commentData }) => {
    const response = await api.post(`/action-tracker/actions/${id}/comments`, commentData);
    return response.data;
  }
);

export const fetchActionComments = createAsyncThunk(
  'actions/fetchActionComments',
  async ({ id, skip = 0, limit = 50 }) => {
    const response = await api.get(`/action-tracker/actions/${id}/comments`, {
      params: { skip, limit }
    });
    return { actionId: id, comments: response.data };
  }
);

export const createAction = createAsyncThunk(
  'actions/createAction',
  async ({ minuteId, actionData }) => {
    const response = await api.post(`/action-tracker/minutes/${minuteId}/actions`, actionData);
    return response.data;
  }
);

export const updateAction = createAsyncThunk(
  'actions/updateAction',
  async ({ id, actionData }) => {
    const response = await api.put(`/action-tracker/actions/${id}`, actionData);
    return response.data;
  }
);

export const deleteAction = createAsyncThunk(
  'actions/deleteAction',
  async (id) => {
    await api.delete(`/action-tracker/actions/${id}`);
    return id;
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
  comments: {}
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
      })
      .addCase(fetchMyTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      
      // Fetch All Actions
      .addCase(fetchAllActions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAllActions.fulfilled, (state, action) => {
        state.loading = false;
        state.allActions = action.payload;
      })
      .addCase(fetchAllActions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      
      // Fetch Action By ID
      .addCase(fetchActionById.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchActionById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentAction = action.payload;
      })
      .addCase(fetchActionById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      
      // Update Action Progress
      .addCase(updateActionProgress.pending, (state) => {
        state.updatingProgress = true;
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
      })
      .addCase(updateActionProgress.rejected, (state, action) => {
        state.updatingProgress = false;
        state.error = action.error.message;
      })
      
      // Fetch Action Comments
      .addCase(fetchActionComments.fulfilled, (state, action) => {
        state.comments[action.payload.actionId] = action.payload.comments;
      })
      
      // Add Action Comment
      .addCase(addActionComment.fulfilled, (state, action) => {
        const actionId = action.payload.action_id;
        if (state.comments[actionId]) {
          state.comments[actionId].unshift(action.payload);
        } else {
          state.comments[actionId] = [action.payload];
        }
      })
      
      // Create Action
      .addCase(createAction.fulfilled, (state, action) => {
        state.allActions.unshift(action.payload);
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
      })
      
      // Delete Action
      .addCase(deleteAction.fulfilled, (state, action) => {
        state.myTasks.items = state.myTasks.items.filter(t => t.id !== action.payload);
        state.allActions = state.allActions.filter(a => a.id !== action.payload);
        if (state.currentAction?.id === action.payload) {
          state.currentAction = null;
        }
      });
  },
});

export const { clearError, setFilters, resetFilters, setCurrentAction, clearCurrentAction } = actionSlice.actions;
export default actionSlice.reducer;