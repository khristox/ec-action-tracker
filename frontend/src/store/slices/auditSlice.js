// src/store/slices/auditSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Helper function to build query params
const buildQueryParams = (params) => {
  const queryParams = {};
  
  // Pagination
  if (params.limit) queryParams.limit = params.limit;
  if (params.offset !== undefined) queryParams.offset = params.offset;
  if (params.page && params.limit) {
    queryParams.offset = (params.page - 1) * params.limit;
  }
  
  // Filters
  if (params.user_id && params.user_id !== 'all') queryParams.user_id = params.user_id;
  if (params.action && params.action !== 'all') queryParams.action = params.action;
  if (params.table_name && params.table_name !== 'all') queryParams.table_name = params.table_name;
  if (params.record_id) queryParams.record_id = params.record_id;
  if (params.status && params.status !== 'all') queryParams.status = params.status;
  if (params.search) queryParams.search = params.search;
  
  // Date filters
  if (params.start_date) queryParams.start_date = params.start_date;
  if (params.end_date) queryParams.end_date = params.end_date;
  
  // Sorting
  if (params.sort_by) queryParams.sort_by = params.sort_by;
  if (params.sort_order) queryParams.sort_order = params.sort_order;
  
  return queryParams;
};

// Fetch audit logs with pagination and filters
export const fetchAuditLogs = createAsyncThunk(
  'audit/fetchAuditLogs',
  async (params, { rejectWithValue, getState }) => {
    try {
      const queryParams = buildQueryParams(params);
      const response = await api.get('/audit/logs', { params: queryParams });
      
      // Transform the response to include additional metadata
      const transformedData = {
        items: response.data.items || [],
        total: response.data.total || 0,
        page: response.data.page || params.page || 1,
        size: response.data.size || params.limit || 25,
        pages: response.data.pages || 0,
        hasNext: response.data.page < response.data.pages,
        hasPrevious: response.data.page > 1,
      };
      
      return transformedData;
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.detail || error.message || 'Failed to fetch audit logs',
        status: error.response?.status,
        data: error.response?.data
      });
    }
  },
  {
    condition: (params, { getState }) => {
      const { audit } = getState();
      // Prevent duplicate requests
      if (audit.isLoading) return false;
      return true;
    }
  }
);

// Get audit statistics summary
export const getAuditStats = createAsyncThunk(
  'audit/getAuditStats',
  async ({ days = 30, start_date, end_date } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (days) params.days = days;
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
      
      const response = await api.get('/audit/summary', { params });
      
      // Calculate additional stats
      const data = response.data;
      const enhancedStats = {
        total_events: data.total_events || 0,
        successful: data.successful || 0,
        failed: data.failed || 0,
        unique_users: data.unique_users || 0,
        success_rate: data.total_events > 0 
          ? ((data.successful / data.total_events) * 100).toFixed(2)
          : 0,
        failed_rate: data.total_events > 0 
          ? ((data.failed / data.total_events) * 100).toFixed(2)
          : 0,
        actions_breakdown: data.actions_breakdown || {},
        daily_activity: data.daily_activity || [],
        top_users: data.top_users || [],
        peak_hours: data.peak_hours || [],
      };
      
      return enhancedStats;
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.detail || error.message || 'Failed to fetch audit stats',
        status: error.response?.status
      });
    }
  }
);

// Get user activity
export const getUserActivity = createAsyncThunk(
  'audit/getUserActivity',
  async ({ userId, days = 7, limit = 50, offset = 0 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/audit/users/${userId}/activity`, {
        params: { days, limit, offset }
      });
      
      return {
        userId,
        activities: response.data || [],
        total: response.headers['x-total-count'] || response.data.length,
      };
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.detail || error.message || 'Failed to fetch user activity',
        userId
      });
    }
  }
);

// Get single audit log by ID
export const getAuditLogById = createAsyncThunk(
  'audit/getAuditLogById',
  async (logId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/audit/logs/${logId}`);
      
      // Parse JSON fields if they're strings
      const log = response.data;
      if (log.old_data && typeof log.old_data === 'string') {
        try { log.old_data = JSON.parse(log.old_data); } catch(e) {}
      }
      if (log.new_data && typeof log.new_data === 'string') {
        try { log.new_data = JSON.parse(log.new_data); } catch(e) {}
      }
      if (log.old_values && typeof log.old_values === 'string') {
        try { log.old_values = JSON.parse(log.old_values); } catch(e) {}
      }
      if (log.new_values && typeof log.new_values === 'string') {
        try { log.new_values = JSON.parse(log.new_values); } catch(e) {}
      }
      if (log.extra_data && typeof log.extra_data === 'string') {
        try { log.extra_data = JSON.parse(log.extra_data); } catch(e) {}
      }
      
      return log;
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.detail || error.message || 'Failed to fetch audit log',
        logId
      });
    }
  }
);

// Get record history
export const getRecordHistory = createAsyncThunk(
  'audit/getRecordHistory',
  async ({ tableName, recordId, limit = 50, offset = 0 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/audit/records/${tableName}/${recordId}/history`, {
        params: { limit, offset }
      });
      
      return {
        tableName,
        recordId,
        history: response.data || [],
        total: response.headers['x-total-count'] || response.data.length,
      };
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.detail || error.message || 'Failed to fetch record history',
        tableName,
        recordId
      });
    }
  }
);

// Clean up old logs (admin only)
export const cleanupOldLogs = createAsyncThunk(
  'audit/cleanupOldLogs',
  async ({ retention_days = 90, confirm = false } = {}, { rejectWithValue }) => {
    if (!confirm) {
      return rejectWithValue({ message: 'Confirmation required for cleanup', requireConfirm: true });
    }
    
    try {
      const response = await api.post('/audit/cleanup', { retention_days });
      return {
        message: response.data.message || 'Cleanup completed successfully',
        deleted_count: response.data.deleted_count || 0,
        retention_days
      };
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.detail || error.message || 'Failed to cleanup old logs',
        status: error.response?.status
      });
    }
  }
);

// Export audit logs
export const exportAuditLogs = createAsyncThunk(
  'audit/exportAuditLogs',
  async ({ format = 'csv', filters = {}, dateRange = {} }, { rejectWithValue }) => {
    try {
      const queryParams = {
        format,
        ...buildQueryParams(filters),
        start_date: dateRange.start_date || filters.start_date,
        end_date: dateRange.end_date || filters.end_date,
      };
      
      const response = await api.get('/audit/export', {
        params: queryParams,
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      
      if (format === 'csv') {
        // Create download link for CSV
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = url;
        link.setAttribute('download', `audit_logs_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        return { success: true, message: 'Export completed successfully', format: 'csv' };
      } else {
        // For JSON, create download
        const jsonStr = JSON.stringify(response.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = url;
        link.setAttribute('download', `audit_logs_${timestamp}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        return { success: true, message: 'Export completed successfully', format: 'json', data: response.data };
      }
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.detail || error.message || 'Failed to export audit logs',
        format
      });
    }
  }
);

// Get available filter options
export const getFilterOptions = createAsyncThunk(
  'audit/getFilterOptions',
  async (_, { rejectWithValue }) => {
    try {
      const [actionsRes, tablesRes, usersRes] = await Promise.all([
        api.get('/audit/actions'),
        api.get('/audit/tables'),
        api.get('/users?limit=1000')
      ]);
      
      return {
        actions: actionsRes.data || [],
        tables: tablesRes.data || [],
        users: usersRes.data?.items || [],
      };
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.detail || error.message || 'Failed to fetch filter options',
      });
    }
  }
);

// Initial state
const initialState = {
  logs: [],
  stats: {
    total_events: 0,
    successful: 0,
    failed: 0,
    unique_users: 0,
    success_rate: 0,
    failed_rate: 0,
    actions_breakdown: {},
    daily_activity: [],
    top_users: [],
    peak_hours: [],
  },
  isLoading: false,
  total: 0,
  page: 1,
  size: 25,
  pages: 0,
  hasNext: false,
  hasPrevious: false,
  error: null,
  selectedLog: null,
  userActivity: {
    activities: [],
    total: 0,
    userId: null,
  },
  recordHistory: {
    history: [],
    total: 0,
    tableName: null,
    recordId: null,
  },
  filterOptions: {
    actions: [],
    tables: [],
    users: [],
  },
  exportProgress: {
    isExporting: false,
    progress: 0,
    format: null,
  },
  lastUpdated: null,
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
    clearUserActivity: (state) => {
      state.userActivity = {
        activities: [],
        total: 0,
        userId: null,
      };
    },
    clearRecordHistory: (state) => {
      state.recordHistory = {
        history: [],
        total: 0,
        tableName: null,
        recordId: null,
      };
    },
    setPage: (state, action) => {
      state.page = action.payload;
    },
    setSize: (state, action) => {
      state.size = action.payload;
      state.page = 1; // Reset to first page when changing page size
    },
    resetAuditState: () => initialState,
    updateExportProgress: (state, action) => {
      state.exportProgress = { ...state.exportProgress, ...action.payload };
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
        state.logs = action.payload.items;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.size = action.payload.size;
        state.pages = action.payload.pages;
        state.hasNext = action.payload.hasNext;
        state.hasPrevious = action.payload.hasPrevious;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to fetch audit logs';
      })
      
      // Get audit stats
      .addCase(getAuditStats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAuditStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(getAuditStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to fetch audit stats';
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
        state.error = action.payload?.message || 'Failed to fetch audit log';
      })
      
      // Get user activity
      .addCase(getUserActivity.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getUserActivity.fulfilled, (state, action) => {
        state.isLoading = false;
        state.userActivity = {
          activities: action.payload.activities,
          total: action.payload.total,
          userId: action.payload.userId,
        };
      })
      .addCase(getUserActivity.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to fetch user activity';
      })
      
      // Get record history
      .addCase(getRecordHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getRecordHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.recordHistory = {
          history: action.payload.history,
          total: action.payload.total,
          tableName: action.payload.tableName,
          recordId: action.payload.recordId,
        };
      })
      .addCase(getRecordHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to fetch record history';
      })
      
      // Cleanup old logs
      .addCase(cleanupOldLogs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cleanupOldLogs.fulfilled, (state, action) => {
        state.isLoading = false;
        // Optionally show success message
      })
      .addCase(cleanupOldLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Failed to cleanup old logs';
      })
      
      // Export logs
      .addCase(exportAuditLogs.pending, (state, action) => {
        state.exportProgress.isExporting = true;
        state.exportProgress.format = action.meta.arg?.format || 'csv';
        state.exportProgress.progress = 0;
        state.error = null;
      })
      .addCase(exportAuditLogs.fulfilled, (state, action) => {
        state.exportProgress.isExporting = false;
        state.exportProgress.progress = 100;
        // Reset progress after 3 seconds
        setTimeout(() => {
          state.exportProgress = { isExporting: false, progress: 0, format: null };
        }, 3000);
      })
      .addCase(exportAuditLogs.rejected, (state, action) => {
        state.exportProgress.isExporting = false;
        state.exportProgress.progress = 0;
        state.error = action.payload?.message || 'Failed to export logs';
      })
      
      // Get filter options
      .addCase(getFilterOptions.fulfilled, (state, action) => {
        state.filterOptions = action.payload;
      });
  },
});

// Selectors
export const selectAllAuditLogs = (state) => state.audit.logs;
export const selectAuditStats = (state) => state.audit.stats;
export const selectAuditLoading = (state) => state.audit.isLoading;
export const selectAuditError = (state) => state.audit.error;
export const selectAuditPagination = (state) => ({
  page: state.audit.page,
  size: state.audit.size,
  total: state.audit.total,
  pages: state.audit.pages,
  hasNext: state.audit.hasNext,
  hasPrevious: state.audit.hasPrevious,
});
export const selectSelectedLog = (state) => state.audit.selectedLog;
export const selectUserActivity = (state) => state.audit.userActivity;
export const selectRecordHistory = (state) => state.audit.recordHistory;
export const selectFilterOptions = (state) => state.audit.filterOptions;
export const selectExportProgress = (state) => state.audit.exportProgress;

export const { 
  clearAuditError, 
  clearSelectedLog, 
  clearUserActivity, 
  clearRecordHistory,
  setPage,
  setSize,
  resetAuditState,
  updateExportProgress,
} = auditSlice.actions;

export default auditSlice.reducer;