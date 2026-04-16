// src/store/slices/auditSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Fetch audit logs with pagination and filters
export const fetchAuditLogs = createAsyncThunk(
  'audit/fetchAuditLogs',
  async (params, { rejectWithValue }) => {
    try {
      // Convert frontend params to match your backend API
      const queryParams = {
        limit: params.limit || 25,
        offset: ((params.page || 1) - 1) * (params.limit || 25),
      };
      
      // Add optional filters
      if (params.user_id) queryParams.user_id = params.user_id;
      if (params.action && params.action !== 'all') queryParams.action = params.action;
      if (params.table_name) queryParams.table_name = params.table_name;
      if (params.record_id) queryParams.record_id = params.record_id;
      if (params.start_date) queryParams.start_date = params.start_date;
      if (params.end_date) queryParams.end_date = params.end_date;
      
      const response = await api.get('/audit/logs', { params: queryParams });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get audit statistics summary
export const getAuditStats = createAsyncThunk(
  'audit/getAuditStats',
  async ({ days = 7 } = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/audit/summary', { params: { days } });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get user activity
export const getUserActivity = createAsyncThunk(
  'audit/getUserActivity',
  async ({ userId, days = 7, limit = 50 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/audit/users/${userId}/activity`, {
        params: { days, limit }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get single audit log by ID
export const getAuditLogById = createAsyncThunk(
  'audit/getAuditLogById',
  async (logId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/audit/logs/${logId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get record history
export const getRecordHistory = createAsyncThunk(
  'audit/getRecordHistory',
  async ({ tableName, recordId, limit = 50 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/audit/records/${tableName}/${recordId}/history`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Clean up old logs (admin only)
export const cleanupOldLogs = createAsyncThunk(
  'audit/cleanupOldLogs',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post('/audit/cleanup');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Export audit logs
export const exportAuditLogs = createAsyncThunk(
  'audit/exportAuditLogs',
  async (params, { rejectWithValue }) => {
    try {
      // Fetch all logs for export (you might want to create a dedicated export endpoint)
      const queryParams = {
        limit: 10000, // Get all logs
        offset: 0,
      };
      
      if (params.action && params.action !== 'all') queryParams.action = params.action;
      if (params.start_date) queryParams.start_date = params.start_date;
      if (params.end_date) queryParams.end_date = params.end_date;
      
      const response = await api.get('/audit/logs', { params: queryParams });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const initialState = {
  logs: [],
  stats: {
    total_events: 0,
    unique_users: 0,
    actions_breakdown: {},
    daily_activity: [],
  },
  isLoading: false,
  total: 0,
  page: 1,
  size: 25,
  pages: 0,
  error: null,
  selectedLog: null,
};

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    clearAuditError: (state) => {
      state.error = null;
    },
    clearSelectedLog: (state) => {
      state.selectedLog = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch audit logs
      .addCase(fetchAuditLogs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.logs = action.payload.items || [];
        state.total = action.payload.total || 0;
        state.page = action.payload.page || 1;
        state.size = action.payload.size || 25;
        state.pages = action.payload.pages || 0;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get audit stats
      .addCase(getAuditStats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAuditStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload;
      })
      .addCase(getAuditStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get single log
      .addCase(getAuditLogById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAuditLogById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedLog = action.payload;
      })
      .addCase(getAuditLogById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get user activity
      .addCase(getUserActivity.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getUserActivity.fulfilled, (state, action) => {
        state.isLoading = false;
        // Handle user activity data as needed
      })
      .addCase(getUserActivity.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get record history
      .addCase(getRecordHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getRecordHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        // Handle record history as needed
      })
      .addCase(getRecordHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Cleanup old logs
      .addCase(cleanupOldLogs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cleanupOldLogs.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(cleanupOldLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Export logs
      .addCase(exportAuditLogs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(exportAuditLogs.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(exportAuditLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearAuditError, clearSelectedLog } = auditSlice.actions;
export default auditSlice.reducer;