// src/store/slices/actionTracker/actionSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// ==================== ASYNC THUNKS ====================

// Action CRUD operations
export const fetchActions = createAsyncThunk(
  'actions/fetchActions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/actions', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const fetchActionById = createAsyncThunk(
  'actions/fetchActionById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/actions/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const createAction = createAsyncThunk(
  'actions/createAction',
  async (actionData, { rejectWithValue }) => {
    try {
      const response = await api.post('/action-tracker/actions', actionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const updateAction = createAsyncThunk(
  'actions/updateAction',
  async ({ id, actionData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/action-tracker/actions/${id}`, actionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const updateActionProgress = createAsyncThunk(
  'actions/updateActionProgress',
  async ({ id, progressData }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/action-tracker/actions/${id}/progress`, progressData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const assignAction = createAsyncThunk(
  'actions/assignAction',
  async ({ id, userId }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/actions/${id}/assign`, { user_id: userId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const deleteAction = createAsyncThunk(
  'actions/deleteAction',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/action-tracker/actions/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

// Comments operations
export const addActionComment = createAsyncThunk(
  'actions/addActionComment',
  async ({ id, commentData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/actions/${id}/comments`, commentData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const fetchActionComments = createAsyncThunk(
  'actions/fetchActionComments',
  async ({ id, skip = 0, limit = 50 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/actions/${id}/comments`, { params: { skip, limit } });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const updateComment = createAsyncThunk(
  'actions/updateComment',
  async ({ actionId, commentId, commentData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/action-tracker/actions/${actionId}/comments/${commentId}`, commentData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const deleteComment = createAsyncThunk(
  'actions/deleteComment',
  async ({ actionId, commentId }, { rejectWithValue }) => {
    try {
      await api.delete(`/action-tracker/actions/${actionId}/comments/${commentId}`);
      return commentId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

// History operations
export const fetchActionHistory = createAsyncThunk(
  'actions/fetchActionHistory',
  async ({ id, skip = 0, limit = 50 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/actions/${id}/history`, { params: { skip, limit } });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

// User tasks
export const fetchMyTasks = createAsyncThunk(
  'actions/fetchMyTasks',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/actions/my-tasks', { params });
      
      // Return the data directly - the reducer will handle formatting
      return response.data;
    } catch (error) {
      console.error('Fetch my tasks error:', error);
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const fetchOverdueTasks = createAsyncThunk(
  'actions/fetchOverdueTasks',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/actions/overdue', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

// Bulk operations
export const bulkUpdateStatus = createAsyncThunk(
  'actions/bulkUpdateStatus',
  async ({ actionIds, statusId }, { rejectWithValue }) => {
    try {
      const response = await api.post('/action-tracker/actions/bulk/update-status', { action_ids: actionIds, status_id: statusId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

// Statistics
export const fetchActionStatistics = createAsyncThunk(
  'actions/fetchActionStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/actions/statistics/summary');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

export const createActionFromMinutes = createAsyncThunk(
  'actions/createActionFromMinutes',
  async ({ minuteId, actionData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/minutes/${minuteId}/actions`, actionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);
// ==================== INITIAL STATE ====================

const initialState = {
  // Data
  actions: [],
  currentAction: null,
  comments: [],
  history: [],
  myTasks: { items: [], total: 0, totalPages: 0, currentPage: 1, limit: 10 },
  overdueTasks: [],
  statistics: null,
  
  // Pagination
  total: 0,
  page: 1,
  pageSize: 20,
  
  // Status
  loading: false,
  updatingProgress: false,
  submittingComment: false,
  error: null,
  
  // Filters
  filters: {
    status_id: null,
    priority: null,
    assigned_to_id: null,
    search: null,
    is_overdue: null,
    include_completed: false
  }
};

// ==================== SLICE ====================

const actionSlice = createSlice({
  name: 'actions',
  initialState,
  reducers: {
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    
    // Current action
    clearCurrentAction: (state) => {
      state.currentAction = null;
      state.comments = [];
      state.history = [];
    },
    
    // Pagination
    setPage: (state, action) => {
      state.page = action.payload;
    },
    setPageSize: (state, action) => {
      state.pageSize = action.payload;
    },
    
    // Filters
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.page = 1;
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
      state.page = 1;
    },
    
    // Optimistic updates
    addCommentOptimistic: (state, action) => {
      if (state.currentAction) {
        state.comments.unshift({
          ...action.payload,
          id: `temp-${Date.now()}`,
          isPending: true
        });
      }
    },
    removeCommentOptimistic: (state, action) => {
      state.comments = state.comments.filter(c => c.id !== action.payload);
    },
    
    // Reset state
    resetActionsState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ========== FETCH ACTIONS ==========
      .addCase(fetchActions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActions.fulfilled, (state, action) => {
        state.loading = false;
        state.actions = action.payload?.items || action.payload || [];
        state.total = action.payload?.total || state.actions.length;
      })
      .addCase(fetchActions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // ========== FETCH ACTION BY ID ==========
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
      })
      
      // ========== CREATE ACTION ==========
      .addCase(createAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAction.fulfilled, (state, action) => {
        state.loading = false;
        state.actions.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // ========== UPDATE ACTION ==========
      .addCase(updateAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAction.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.actions.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.actions[index] = action.payload;
        }
        if (state.currentAction?.id === action.payload.id) {
          state.currentAction = action.payload;
        }
      })
      .addCase(updateAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // ========== UPDATE PROGRESS ==========
      .addCase(updateActionProgress.pending, (state) => {
        state.updatingProgress = true;
        state.error = null;
      })
      .addCase(updateActionProgress.fulfilled, (state, action) => {
        state.updatingProgress = false;
        const index = state.actions.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.actions[index] = action.payload;
        }
        if (state.currentAction?.id === action.payload.id) {
          state.currentAction = action.payload;
        }
      })
      .addCase(updateActionProgress.rejected, (state, action) => {
        state.updatingProgress = false;
        state.error = action.payload;
      })
      
      // ========== ASSIGN ACTION ==========
      .addCase(assignAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(assignAction.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.actions.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.actions[index] = action.payload;
        }
        if (state.currentAction?.id === action.payload.id) {
          state.currentAction = action.payload;
        }
      })
      .addCase(assignAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // ========== DELETE ACTION ==========
      .addCase(deleteAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteAction.fulfilled, (state, action) => {
        state.loading = false;
        state.actions = state.actions.filter(a => a.id !== action.payload);
        state.total -= 1;
        if (state.currentAction?.id === action.payload) {
          state.currentAction = null;
        }
      })
      .addCase(deleteAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // ========== COMMENTS ==========
      .addCase(addActionComment.pending, (state) => {
        state.submittingComment = true;
        state.error = null;
      })
      .addCase(addActionComment.fulfilled, (state, action) => {
        state.submittingComment = false;
        if (state.currentAction) {
          state.comments.unshift(action.payload);
        }
      })
      .addCase(addActionComment.rejected, (state, action) => {
        state.submittingComment = false;
        state.error = action.payload;
      })
      
      .addCase(fetchActionComments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActionComments.fulfilled, (state, action) => {
        state.loading = false;
        state.comments = action.payload?.items || action.payload || [];
      })
      .addCase(fetchActionComments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      .addCase(updateComment.fulfilled, (state, action) => {
        const index = state.comments.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.comments[index] = action.payload;
        }
      })
      
      .addCase(deleteComment.fulfilled, (state, action) => {
        state.comments = state.comments.filter(c => c.id !== action.payload);
      })
      
      // ========== HISTORY ==========
      .addCase(fetchActionHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActionHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.history = action.payload?.items || action.payload || [];
      })
      .addCase(fetchActionHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // ========== MY TASKS ==========
      .addCase(fetchMyTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyTasks.fulfilled, (state, action) => {
        state.loading = false;
        // Handle the response - backend returns an array directly
        const tasks = Array.isArray(action.payload) ? action.payload : (action.payload?.items || []);
        state.myTasks = {
          items: tasks,
          total: tasks.length,
          totalPages: Math.ceil(tasks.length / 10),
          currentPage: 1,
          limit: 10
        };
      })
      .addCase(fetchMyTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        console.error('MyTasks error:', action.payload);
      })
      
      // ========== OVERDUE TASKS ==========
      .addCase(fetchOverdueTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOverdueTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.overdueTasks = action.payload?.items || action.payload || [];
      })
      .addCase(fetchOverdueTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // ========== STATISTICS ==========
      .addCase(fetchActionStatistics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActionStatistics.fulfilled, (state, action) => {
        state.loading = false;
        state.statistics = action.payload;
      })
      .addCase(fetchActionStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // ========== BULK OPERATIONS ==========
      .addCase(bulkUpdateStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bulkUpdateStatus.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(bulkUpdateStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // ========== CREATE ACTION FROM MINUTES ==========
      .addCase(createActionFromMinutes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createActionFromMinutes.fulfilled, (state, action) => {
        state.loading = false;
        state.actions.unshift(action.payload);
        state.total += 1;
        state.currentAction = action.payload; // Optional: set as current
      })
      .addCase(createActionFromMinutes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

// ==================== EXPORT ACTIONS ====================

export const {
  clearError,
  clearCurrentAction,
  setPage,
  setPageSize,
  setFilters,
  clearFilters,
  addCommentOptimistic,
  removeCommentOptimistic,
  resetActionsState
} = actionSlice.actions;

// ==================== SELECTORS ====================

// Basic selectors
export const selectAllActions = (state) => state.actions?.actions || [];
export const selectCurrentAction = (state) => state.actions?.currentAction || null;
export const selectActionsLoading = (state) => state.actions?.loading || false;
export const selectUpdatingProgress = (state) => state.actions?.updatingProgress || false;
export const selectSubmittingComment = (state) => state.actions?.submittingComment || false;
export const selectActionsError = (state) => state.actions?.error || null;
export const selectActionsTotal = (state) => state.actions?.total || 0;
export const selectActionsPage = (state) => state.actions?.page || 1;
export const selectActionsPageSize = (state) => state.actions?.pageSize || 20;
export const selectActionsFilters = (state) => state.actions?.filters || initialState.filters;

// Comments and history
export const selectActionComments = (state) => state.actions?.comments || [];
export const selectActionHistory = (state) => state.actions?.history || [];

// Tasks
export const selectMyTasks = (state) => state.actions?.myTasks || { items: [], total: 0, totalPages: 0 };
export const selectOverdueTasks = (state) => state.actions?.overdueTasks || [];

// Statistics
export const selectActionStatistics = (state) => state.actions?.statistics || null;

// Derived selectors
export const selectCompletedActions = (state) => {
  const actions = selectAllActions(state);
  return actions.filter(a => a.completed_at || a.overall_progress_percentage >= 100);
};

export const selectInProgressActions = (state) => {
  const actions = selectAllActions(state);
  return actions.filter(a => !a.completed_at && a.overall_progress_percentage > 0 && a.overall_progress_percentage < 100);
};

export const selectNotStartedActions = (state) => {
  const actions = selectAllActions(state);
  return actions.filter(a => !a.completed_at && (!a.overall_progress_percentage || a.overall_progress_percentage === 0));
};

export const selectOverdueActions = (state) => {
  const actions = selectAllActions(state);
  const now = new Date();
  return actions.filter(a => 
    !a.completed_at && 
    a.due_date && 
    new Date(a.due_date) < now
  );
};

export const selectActionsByPriority = (state, priority) => {
  const actions = selectAllActions(state);
  return actions.filter(a => a.priority === priority);
};

export const selectActionsByAssignee = (state, userId) => {
  const actions = selectAllActions(state);
  return actions.filter(a => a.assigned_to_id === userId);
};

// ==================== EXPORT REDUCER ====================

export default actionSlice.reducer;