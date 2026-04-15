import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../api/apiClient';

// Fetch audit logs
export const fetchAuditLogs = createAsyncThunk(
  'audit/fetchLogs',
  async ({ page = 1, limit = 25, search = '', action = null, status = null, start_date = null, end_date = null }, { rejectWithValue }) => {
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (action) params.action = action;
      if (status) params.status = status;
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
      
      const response = await apiClient.get('/admin/audit-logs', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get audit statistics
export const getAuditStats = createAsyncThunk(
  'audit/getStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/admin/audit-logs/stats');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Export audit logs
export const exportAuditLogs = createAsyncThunk(
  'audit/exportLogs',
  async (filters, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/admin/audit-logs/export', filters);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const initialState = {
  logs: [],
  stats: null,
  total: 0,
  isLoading: false,
  error: null,
};

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    clearAuditError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Logs
      .addCase(fetchAuditLogs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.logs = action.payload.items || action.payload;
        state.total = action.payload.total || action.payload.length;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Get Stats
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
      
      // Export Logs
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

export const { clearAuditError } = auditSlice.actions;
export default auditSlice.reducer;