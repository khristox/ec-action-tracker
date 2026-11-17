// src/store/slices/actionTracker/notificationSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { deduplicatedGet, deduplicatedPost } from '../../../utils/requestUtils';

// ==================== FETCH MEETING PARTICIPANTS ====================

export const fetchMeetingParticipants = createAsyncThunk(
  'notifications/fetchMeetingParticipants',
  async (meetingId, { rejectWithValue }) => {
    try {
      const key = `meeting_members_${meetingId}`;

      const response = await deduplicatedGet(
        `/action-tracker/meetings/${meetingId}/members`,
        {},
        { key }
      );

      const data = response.data;

      if (Array.isArray(data)) {
        return data;
      }

      if (Array.isArray(data?.items)) {
        return data.items;
      }

      if (Array.isArray(data?.members)) {
        return data.members;
      }

      if (Array.isArray(data?.participants)) {
        return data.participants;
      }

      return [];
    } catch (error) {
      if (
        error?.name === 'CanceledError' ||
        error?.code === 'ERR_CANCELED'
      ) {
        throw error;
      }

      return rejectWithValue(
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to fetch meeting members'
      );
    }
  }
);

// ==================== FETCH ALL MEMBERS (for notification dialog) ====================

export const fetchAllMembers = createAsyncThunk(
  'notifications/fetchAllMembers',
  async (_, { getState, rejectWithValue }) => {
    try {
      // Prevent redundant fetches if already loaded
      const state = getState();
      if (state.notifications?.allMembers && state.notifications.allMembers.length > 0) {
        return state.notifications.allMembers;
      }

      const response = await deduplicatedGet(
        '/members',
        {},
        { key: 'all_members_list' }
      );
      
      if (response.data) {
        if (Array.isArray(response.data)) return response.data;
        if (response.data.items && Array.isArray(response.data.items)) return response.data.items;
        if (response.data.members && Array.isArray(response.data.members)) return response.data.members;
        if (response.data.data && Array.isArray(response.data.data)) return response.data.data;
      }
      
      return [];
    } catch (error) {
      if (error.message === 'canceled' || error.code === 'ERR_CANCELED') {
        return [];
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to load members');
    }
  }
);

// ==================== SEND MEETING NOTIFICATIONS ====================

export const sendMeetingNotifications = createAsyncThunk(
  'notifications/sendMeetingNotifications',
  async ({ meetingId, notificationData }, { rejectWithValue }) => {
    try {
      const response = await deduplicatedPost(
        `/action-tracker/meetings/${meetingId}/notifications`,
        notificationData,
        { key: `send_notifications_${meetingId}` }
      );
      return response.data;
    } catch (error) {
      if (error.message === 'canceled' || error.code === 'ERR_CANCELED') {
        return { canceled: true };
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to send notifications');
    }
  }
);

// ==================== SEND EMAIL NOTIFICATIONS ====================

export const sendEmailNotifications = createAsyncThunk(
  'notifications/sendEmailNotifications',
  async ({ meetingId, emailData }, { rejectWithValue }) => {
    try {
      const response = await deduplicatedPost(
        `/action-tracker/meetings/${meetingId}/notifications/email`,
        emailData,
        { key: `send_emails_${meetingId}` }
      );
      return response.data;
    } catch (error) {
      if (error.message === 'canceled' || error.code === 'ERR_CANCELED') {
        return { canceled: true };
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to send email notifications');
    }
  }
);

// ==================== FETCH NOTIFICATION HISTORY ====================

export const fetchNotificationHistory = createAsyncThunk(
  'notifications/fetchNotificationHistory',
  async ({ meetingId, params = {} }, { rejectWithValue }) => {
    try {
      const key = `notification_history_${meetingId}_${JSON.stringify(params)}`;
      const response = await deduplicatedGet(
        `/action-tracker/meetings/${meetingId}/notifications`,
        params,
        { key }
      );
      
      if (response.data) {
        if (Array.isArray(response.data)) {
          return { items: response.data, total: response.data.length };
        }
        if (response.data.items && Array.isArray(response.data.items)) {
          return response.data;
        }
        if (response.data.data && Array.isArray(response.data.data)) {
          return { items: response.data.data, total: response.data.data.length };
        }
      }
      return { items: [], total: 0 };
    } catch (error) {
      if (error.message === 'canceled' || error.code === 'ERR_CANCELED') {
        return { items: [], total: 0 };
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch notification history');
    }
  }
);

// ==================== SLICE ====================

const initialState = {
  participants: [],
  allMembers: [],
  notificationHistory: { items: [], total: 0 },
  sending: false,
  error: null,
  lastNotificationResult: null,
  isLoading: false,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotificationError: (state) => {
      state.error = null;
    },
    clearLastNotificationResult: (state) => {
      state.lastNotificationResult = null;
    },
    setParticipants: (state, action) => {
      state.participants = Array.isArray(action.payload) ? action.payload : [];
      state.error = null;
    },
    clearNotificationHistory: (state) => {
      state.notificationHistory = { items: [], total: 0 };
    },
    resetNotificationState: (state) => {
      state.participants = [];
      state.allMembers = [];
      state.notificationHistory = { items: [], total: 0 };
      state.sending = false;
      state.error = null;
      state.lastNotificationResult = null;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Meeting Participants
      .addCase(fetchMeetingParticipants.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMeetingParticipants.fulfilled, (state, action) => {
        state.isLoading = false;
        state.participants = Array.isArray(action.payload) ? action.payload : [];
        state.error = null;
      })
      .addCase(fetchMeetingParticipants.rejected, (state, action) => {
        state.isLoading = false;
        state.participants = [];
        state.error = action.payload || 'Failed to load participants';
      })
      
      // Fetch All Members
      .addCase(fetchAllMembers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllMembers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.allMembers = Array.isArray(action.payload) ? action.payload : [];
        state.error = null;
      })
      .addCase(fetchAllMembers.rejected, (state, action) => {
        state.isLoading = false;
        state.allMembers = [];
        state.error = action.payload || 'Failed to load members';
      })
      
      // Send Notifications
      .addCase(sendMeetingNotifications.pending, (state) => {
        state.sending = true;
        state.error = null;
      })
      .addCase(sendMeetingNotifications.fulfilled, (state, action) => {
        state.sending = false;
        state.lastNotificationResult = action.payload;
        state.error = null;
      })
      .addCase(sendMeetingNotifications.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload || 'Failed to send notifications';
      })
      
      // Send Email Notifications
      .addCase(sendEmailNotifications.pending, (state) => {
        state.sending = true;
        state.error = null;
      })
      .addCase(sendEmailNotifications.fulfilled, (state, action) => {
        state.sending = false;
        state.lastNotificationResult = action.payload;
        state.error = null;
      })
      .addCase(sendEmailNotifications.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload || 'Failed to send email notifications';
      })
      
      // Fetch Notification History
      .addCase(fetchNotificationHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotificationHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.notificationHistory = action.payload;
        state.error = null;
      })
      .addCase(fetchNotificationHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.notificationHistory = { items: [], total: 0 };
        state.error = action.payload || 'Failed to fetch notification history';
      });
  },
});

export const { 
  clearNotificationError, 
  clearLastNotificationResult, 
  setParticipants,
  clearNotificationHistory,
  resetNotificationState
} = notificationSlice.actions;

// ==================== SELECTORS ====================

export const selectNotificationParticipants = (state) => state.notifications.participants;
export const selectAllMembers = (state) => state.notifications.allMembers;
export const selectNotificationSending = (state) => state.notifications.sending;
export const selectNotificationError = (state) => state.notifications.error;
export const selectLastNotificationResult = (state) => state.notifications.lastNotificationResult;
export const selectNotificationHistory = (state) => state.notifications.notificationHistory;
export const selectNotificationLoading = (state) => state.notifications.isLoading;

export default notificationSlice.reducer;