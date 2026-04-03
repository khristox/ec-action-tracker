import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// Async thunks
export const fetchMeetings = createAsyncThunk(
  'meetings/fetchMeetings',
  async (params = {}) => {
    const response = await api.get('/action-tracker/meetings', { params });
    return response.data;
  }
);

export const fetchMeetingById = createAsyncThunk(
  'meetings/fetchMeetingById',
  async (id) => {
    const response = await api.get(`/action-tracker/meetings/${id}`);
    return response.data;
  }
);

export const createMeeting = createAsyncThunk(
  'meetings/createMeeting',
  async (meetingData) => {
    const response = await api.post('/action-tracker/meetings', meetingData);
    return response.data;
  }
);

export const updateMeeting = createAsyncThunk(
  'meetings/updateMeeting',
  async ({ id, data }) => {
    const response = await api.put(`/action-tracker/meetings/${id}`, data);
    return response.data;
  }
);

export const deleteMeeting = createAsyncThunk(
  'meetings/deleteMeeting',
  async (id) => {
    await api.delete(`/action-tracker/meetings/${id}`);
    return id;
  }
);

export const addMeetingMinutes = createAsyncThunk(
  'meetings/addMeetingMinutes',
  async ({ meetingId, minutesData }) => {
    const response = await api.post(`/action-tracker/meetings/${meetingId}/minutes`, minutesData);
    return response.data;
  }
);

const meetingSlice = createSlice({
  name: 'meetings',
  initialState: {
    meetings: [],
    currentMeeting: null,
    loading: false,
    error: null,
    totalPages: 1,
    currentPage: 1,
  },
  reducers: {
    clearCurrentMeeting: (state) => {
      state.currentMeeting = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Meetings
      .addCase(fetchMeetings.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMeetings.fulfilled, (state, action) => {
        state.loading = false;
        state.meetings = action.payload;
      })
      .addCase(fetchMeetings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch Meeting By ID
      .addCase(fetchMeetingById.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMeetingById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentMeeting = action.payload;
      })
      .addCase(fetchMeetingById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Create Meeting
      .addCase(createMeeting.fulfilled, (state, action) => {
        state.meetings.unshift(action.payload);
      })
      // Update Meeting
      .addCase(updateMeeting.fulfilled, (state, action) => {
        const index = state.meetings.findIndex(m => m.id === action.payload.id);
        if (index !== -1) {
          state.meetings[index] = action.payload;
        }
        if (state.currentMeeting?.id === action.payload.id) {
          state.currentMeeting = action.payload;
        }
      })
      // Delete Meeting
      .addCase(deleteMeeting.fulfilled, (state, action) => {
        state.meetings = state.meetings.filter(m => m.id !== action.payload);
        if (state.currentMeeting?.id === action.payload) {
          state.currentMeeting = null;
        }
      });
  },
});

export const { clearCurrentMeeting, clearError } = meetingSlice.actions;
export default meetingSlice.reducer;