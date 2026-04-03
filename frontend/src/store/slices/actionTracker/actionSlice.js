import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

export const fetchMyTasks = createAsyncThunk(
  'actions/fetchMyTasks',
  async () => {
    const response = await api.get('/action-tracker/actions/my-tasks');
    return response.data;
  }
);

export const fetchAllActions = createAsyncThunk(
  'actions/fetchAllActions',
  async (params = {}) => {
    const response = await api.get('/action-tracker/actions', { params });
    return response.data;
  }
);

export const updateActionProgress = createAsyncThunk(
  'actions/updateActionProgress',
  async ({ id, progressData }) => {
    const response = await api.post(`/action-tracker/actions/${id}/progress`, progressData);
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

export const createAction = createAsyncThunk(
  'actions/createAction',
  async ({ minuteId, actionData }) => {
    const response = await api.post(`/action-tracker/minutes/${minuteId}/actions`, actionData);
    return response.data;
  }
);

const actionSlice = createSlice({
  name: 'actions',
  initialState: {
    myTasks: [],
    allActions: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch My Tasks
      .addCase(fetchMyTasks.pending, (state) => {
        state.loading = true;
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
      // Update Action Progress
      .addCase(updateActionProgress.fulfilled, (state, action) => {
        const index = state.myTasks.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.myTasks[index] = action.payload;
        }
        const allIndex = state.allActions.findIndex(a => a.id === action.payload.id);
        if (allIndex !== -1) {
          state.allActions[allIndex] = action.payload;
        }
      })
      // Create Action
      .addCase(createAction.fulfilled, (state, action) => {
        state.allActions.unshift(action.payload);
      });
  },
});

export const { clearError } = actionSlice.actions;
export default actionSlice.reducer;