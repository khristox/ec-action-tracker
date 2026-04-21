// store/slices/actionTracker/notificationSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// Async thunk for sending notifications
export const sendMeetingNotifications = createAsyncThunk(
  'notifications/sendMeetingNotifications',
  async ({ meetingId, notificationData }, { rejectWithValue }) => {
    try {
      const response = await api.post(
        `/action-tracker/meetings/${meetingId}/notify-participants`,
        notificationData
      );
      console.log('Send notifications request data:', notificationData);
      console.log('Send notifications response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Send notifications error:', error);
      return rejectWithValue(error.response?.data?.detail || 'Failed to send notifications');
    }
  }
);

// Async thunk for fetching meeting participants
export const fetchMeetingParticipants = createAsyncThunk(
  'notifications/fetchMeetingParticipants',
  async (meetingId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/participants`);
      
      // Handle different response structures
      let participantsData = [];
      if (response.data?.items) {
        participantsData = response.data.items;
      } else if (Array.isArray(response.data)) {
        participantsData = response.data;
      } else if (response.data?.data) {
        participantsData = response.data.data;
      } else {
        participantsData = [];
      }
      
      return participantsData;
    } catch (error) {
      console.error('Fetch participants error:', error);
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch participants');
    }
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    participants: [],
    loading: false,
    sending: false,
    error: null,
    lastNotificationResult: null,
  },
  reducers: {
    clearNotificationError: (state) => {
      state.error = null;
    },
    clearLastNotificationResult: (state) => {
      state.lastNotificationResult = null;
    },
    clearParticipants: (state) => {
      state.participants = [];
    },
    setParticipants: (state, action) => {
      state.participants = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch participants
      .addCase(fetchMeetingParticipants.pending, (state) => {
        state.loading = true;
        state.error = null;
        console.log('Fetching participants...');
      })
      .addCase(fetchMeetingParticipants.fulfilled, (state, action) => {
        state.loading = false;
        state.participants = action.payload;
        console.log('Participants fetched successfully:', state.participants.length);
      })
      .addCase(fetchMeetingParticipants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        console.error('Failed to fetch participants:', action.payload);
      })
      // Send notifications
      .addCase(sendMeetingNotifications.pending, (state) => {
        state.sending = true;
        state.error = null;
        console.log('Sending notifications...');
      })
      .addCase(sendMeetingNotifications.fulfilled, (state, action) => {
        state.sending = false;
        state.lastNotificationResult = action.payload;
        console.log('Notifications sent successfully:', action.payload);
      })
      .addCase(sendMeetingNotifications.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload;
        console.error('Failed to send notifications:', action.payload);
      });
  },
});

export const {
  clearNotificationError,
  clearLastNotificationResult,
  clearParticipants,
  setParticipants,
} = notificationSlice.actions;

export default notificationSlice.reducer;

// Improved selectors with error handling
export const selectNotificationParticipants = (state) => {
  console.log('Full Redux state:', state);
  console.log('Notifications slice:', state.notifications);
  
  if (!state || !state.notifications) {
    console.warn('Notifications slice not found in state');
    return [];
  }
  return state.notifications.participants || [];
};

export const selectNotificationLoading = (state) => {
  return state?.notifications?.loading || false;
};

export const selectNotificationSending = (state) => {
  return state?.notifications?.sending || false;
};

export const selectNotificationError = (state) => {
  return state?.notifications?.error;
};

export const selectLastNotificationResult = (state) => {
  return state?.notifications?.lastNotificationResult;
};