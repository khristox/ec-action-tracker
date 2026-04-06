// frontend/src/store/slices/actionTracker/meetingSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// ==================== ASYNC THUNKS ====================

// Fetch meeting by ID
export const fetchMeetingById = createAsyncThunk(
  'meetings/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/meetings/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch meeting');
    }
  }
);

// Fetch meeting status options from attributes
export const fetchMeetingStatusOptions = createAsyncThunk(
  'meetings/fetchStatusOptions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/attribute-groups/ACTION_TRACKER/attributes');
      const attributes = response.data.items || response.data || [];
      
      // Filter for meeting status attributes
      const meetingStatuses = attributes.filter(attr => 
        attr.code?.startsWith('MEETING_STATUS_')
      );
      
      // Transform to options format
      const options = meetingStatuses.map(status => ({
        value: status.short_name?.toLowerCase() || status.code?.replace('MEETING_STATUS_', '').toLowerCase(),
        label: status.name?.replace('Meeting Status - ', ''),
        originalLabel: status.name,
        code: status.code,
        id:status.id,
        shortName: status.short_name,
        color: status.extra_metadata?.color || '#64748b',
        icon: status.extra_metadata?.icon || 'schedule',
        description: status.extra_metadata?.description || '',
        sortOrder: status.sort_order
      })).sort((a, b) => a.sortOrder - b.sortOrder);
      
      return options;
    } catch (error) {
      console.error('Error fetching status options:', error);
      // Return fallback options
      return [
        { value: 'pending', label: 'Pending', color: '#FFC107', icon: 'pending', description: 'Meeting scheduled but not started' },
        { value: 'started', label: 'Started', color: '#2196F3', icon: 'play_circle', description: 'Meeting in progress' },
        { value: 'ended', label: 'Ended', color: '#9E9E9E', icon: 'stop_circle', description: 'Meeting ended' },
        { value: 'awaiting_action', label: 'Awaiting Action', color: '#FF9800', icon: 'pending_actions', description: 'Meeting completed, awaiting action items' },
        { value: 'closed', label: 'Closed', color: '#4CAF50', icon: 'check_circle', description: 'Meeting fully completed and closed' },
        { value: 'cancelled', label: 'Cancelled', color: '#F44336', icon: 'cancel', description: 'Meeting cancelled' },
      ];
    }
  }
);

// Update meeting - handles all meeting updates including status
export const updateMeeting = createAsyncThunk(
  'meetings/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      console.log('🔵 updateMeeting called with:', { id, data });
      
      const requestData = { ...data };
      console.log('📦 Sending request data:', requestData);
      
      const response = await api.put(`/action-tracker/meetings/${id}`, requestData);
      console.log('✅ Update response:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ Update meeting error:', error.response?.data);
      return rejectWithValue(error.response?.data?.detail || 'Failed to update meeting');
    }
  }
);

// Update meeting status - dedicated endpoint for status only (using PATCH)
// frontend/src/store/slices/actionTracker/meetingSlice.js

// Update meeting status - use PUT instead of PATCH
export const updateMeetingStatus = createAsyncThunk(
  'meetings/updateStatus',
  async ({ id, status, status_id,status_comment,status_date }, { rejectWithValue }) => {
    try {
      console.log('🔵 updateMeetingStatus called with:', { id, status });
      
      // Use PUT to update the meeting with status field
      const response = await api.put(`/action-tracker/meetings/${id}`, { 
        status: status ,
        status_id: status_id,
        status_comment:status_comment,
        status_date:status_date,
      });
      
      console.log('✅ Status update response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Status update error:', error.response?.data);
      return rejectWithValue(error.response?.data?.detail || 'Failed to update status');
    }
  }
);

// Add action to meeting
export const addMeetingAction = createAsyncThunk(
  'meetings/addAction',
  async ({ minuteId, actionData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/minutes/${minuteId}/actions`, actionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to add action');
    }
  }
);

// Update action progress
// In your actionSlice.js
export const updateActionProgress = createAsyncThunk(
  'actions/updateActionProgress',
  async ({ id, progressData }) => {
    // Ensure the payload structure matches backend expectations
    const payload = {
      progress_percentage: progressData.progress_percentage,
      individual_status_id: progressData.individual_status_id,
      remarks: progressData.remarks
    };
    
    console.log('Sending progress update to backend:', payload);
    const response = await api.post(`/action-tracker/actions/${id}/progress`, payload);
    return response.data;
  }
);

// Add participant to meeting
export const addMeetingParticipant = createAsyncThunk(
  'meetings/addParticipant',
  async ({ meetingId, participantData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/meetings/${meetingId}/participants`, participantData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to add participant');
    }
  }
);

// ==================== SLICE ====================

const initialState = {
  currentMeeting: null,
  statusOptions: [],
  loading: false,
  error: null,
  updating: false,
  updateSuccess: false,
};

const meetingSlice = createSlice({
  name: 'meetings',
  initialState,
  reducers: {
    clearCurrentMeeting: (state) => {
      state.currentMeeting = null;
      state.error = null;
      state.updateSuccess = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearUpdateSuccess: (state) => {
      state.updateSuccess = false;
    },
    updateLocalMeetingStatus: (state, action) => {
      if (state.currentMeeting) {
        state.currentMeeting.status = action.payload;
      }
    },
    updateLocalActionProgress: (state, action) => {
      const { actionId, progress } = action.payload;
      if (state.currentMeeting && state.currentMeeting.minutes) {
        state.currentMeeting.minutes.forEach(minute => {
          const action = minute.actions?.find(a => a.id === actionId);
          if (action) {
            action.overall_progress_percentage = progress;
            if (progress === 100) {
              action.completed_at = new Date().toISOString();
            }
          }
        });
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Meeting by ID
      .addCase(fetchMeetingById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMeetingById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentMeeting = action.payload;
      })
      .addCase(fetchMeetingById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch Status Options
      .addCase(fetchMeetingStatusOptions.fulfilled, (state, action) => {
        state.statusOptions = action.payload;
      })
      
      // Update Meeting (PUT)
      .addCase(updateMeeting.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateMeeting.fulfilled, (state, action) => {
        state.updating = false;
        state.currentMeeting = action.payload;
        state.updateSuccess = true;
      })
      .addCase(updateMeeting.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })
      
      // Update Meeting Status (PATCH)
      .addCase(updateMeetingStatus.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateMeetingStatus.fulfilled, (state, action) => {
        state.updating = false;
        state.currentMeeting = action.payload;
        state.updateSuccess = true;
      })
      .addCase(updateMeetingStatus.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })
      
      // Add Action
      .addCase(addMeetingAction.fulfilled, (state, action) => {
        if (state.currentMeeting && state.currentMeeting.minutes) {
          const minute = state.currentMeeting.minutes.find(m => 
            m.id === action.payload.minute_id
          );
          if (minute) {
            minute.actions = minute.actions || [];
            minute.actions.push(action.payload);
          }
        }
      })
      .addCase(addMeetingAction.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Update Action Progress
      .addCase(updateActionProgress.fulfilled, (state, action) => {
        if (state.currentMeeting && state.currentMeeting.minutes) {
          state.currentMeeting.minutes.forEach(minute => {
            const actionIndex = minute.actions?.findIndex(a => a.id === action.payload.id);
            if (actionIndex !== -1 && actionIndex !== undefined) {
              minute.actions[actionIndex] = action.payload;
            }
          });
        }
      })
      .addCase(updateActionProgress.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

// ==================== SELECTORS ====================

export const selectCurrentMeeting = (state) => state.meetings.currentMeeting;
export const selectMeetingLoading = (state) => state.meetings.loading;
export const selectMeetingUpdating = (state) => state.meetings.updating;
export const selectMeetingError = (state) => state.meetings.error;
export const selectUpdateSuccess = (state) => state.meetings.updateSuccess;
export const selectStatusOptions = (state) => state.meetings.statusOptions;

// ==================== EXPORTS ====================

export const {
  clearCurrentMeeting,
  clearError,
  clearUpdateSuccess,
  updateLocalMeetingStatus,
  updateLocalActionProgress,
} = meetingSlice.actions;

export default meetingSlice.reducer;