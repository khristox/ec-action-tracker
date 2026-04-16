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
      return response.data;                    // ← Return the full action object
    } catch (error) {
      console.error('fetchActionById failed:', error.response?.data || error);
      if (error.response?.status === 404) return rejectWithValue('Task not found');
      if (error.response?.status === 403) return rejectWithValue('Permission denied');
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch task');
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

// Keep these if you use them elsewhere
export const fetchAllActions = createAsyncThunk('actions/fetchAllActions', async (params = {}, { rejectWithValue }) => {
  try {
    const response = await api.get('/action-tracker/actions', { params });
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.detail || 'Failed to fetch actions');
  }
});

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

// ====================== SLICE ======================

const initialState = {
  myTasks: { items: [], total: 0, page: 1, limit: 10, totalPages: 1 },
  allActions: { items: [], total: 0, page: 1, limit: 10, totalPages: 1 },
  currentAction: null,
  loading: false,
  updatingProgress: false,
  error: null,
  success: false,
};

const actionSlice = createSlice({
  name: 'actions',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    clearSuccess: (state) => { state.success = false; },
    clearCurrentAction: (state) => { state.currentAction = null; },
  },
  extraReducers: (builder) => {
    builder
      // Fetch My Tasks
      .addCase(fetchMyTasks.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMyTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.myTasks = action.payload;
      })
      .addCase(fetchMyTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Single Action (Critical for ActionDetail)
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
        if (state.currentAction?.id === action.meta.arg.id) {
          state.currentAction = action.payload;   // Update current action in place
        }
      })
      .addCase(updateActionProgress.rejected, (state, action) => {
        state.updatingProgress = false;
        state.error = action.payload;
      })

      // Add Comment
      .addCase(addActionComment.fulfilled, (state) => {
        // You can refresh currentAction here if needed
      })
      .addCase(addActionComment.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearError, clearSuccess, clearCurrentAction } = actionSlice.actions;
export default actionSlice.reducer;