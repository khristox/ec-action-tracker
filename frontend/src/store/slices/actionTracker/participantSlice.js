import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// Fetch Participants with trailing slash
export const fetchParticipants = createAsyncThunk(
  'participants/fetchParticipants',
  async (params = {}) => {
    const response = await api.get('/action-tracker/participants/', { params });
    
    if (response.data && typeof response.data === 'object') {
      if ('items' in response.data && Array.isArray(response.data.items)) {
        return response.data;
      }
      if (Array.isArray(response.data)) {
        return {
          items: response.data,
          total: response.data.length,
          pages: 1,
          page: params.page || 1,
          limit: params.limit || response.data.length
        };
      }
    }
    return response.data;
  }
);

// Create Participant with trailing slash
export const createParticipant = createAsyncThunk(
  'participants/createParticipant',
  async (participantData) => {
    // Adding '/' ensures FastAPI doesn't trigger a 307/301 redirect
    const response = await api.post('/action-tracker/participants/', participantData);
    return response.data;
  }
);

export const updateParticipant = createAsyncThunk(
  'participants/updateParticipant',
  async ({ id, data }) => {
    const response = await api.put(`/action-tracker/participants/${id}/`, data);
    return response.data;
  }
);

export const deleteParticipant = createAsyncThunk(
  'participants/deleteParticipant',
  async (id) => {
    await api.delete(`/action-tracker/participants/${id}/`);
    return id;
  }
);

const participantSlice = createSlice({
  name: 'participants',
  initialState: {
    participants: {
      items: [],
      total: 0,
      pages: 1,
      page: 1,
      limit: 20
    },
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearParticipants: (state) => {
      state.participants = { items: [], total: 0, pages: 1, page: 1, limit: 20 };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchParticipants.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchParticipants.fulfilled, (state, action) => {
        state.loading = false;
        state.participants = {
          items: action.payload.items || [],
          total: action.payload.total || 0,
          pages: action.payload.pages || 1,
          page: action.payload.page || 1,
          limit: action.payload.limit || 20
        };
      })
      .addCase(fetchParticipants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch participants';
      })
      .addCase(createParticipant.pending, (state) => {
        state.loading = true;
      })
      .addCase(createParticipant.fulfilled, (state) => {
        state.loading = false;
        // We let the component re-fetch the list to ensure pagination stays correct
      })
      .addCase(createParticipant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const { clearError, clearParticipants } = participantSlice.actions;
export default participantSlice.reducer;