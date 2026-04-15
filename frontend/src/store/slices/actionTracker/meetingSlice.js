// src/store/slices/actionTracker/meetingSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// ==================== Async Thunks ====================

// Create a new meeting
export const createMeeting = createAsyncThunk(
  'meetings/createMeeting',
  async (meetingData, { rejectWithValue }) => {
    try {
      const response = await api.post('/action-tracker/meetings/', meetingData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch all meetings
export const fetchMeetings = createAsyncThunk(
  'meetings/fetchMeetings',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/meetings/', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch a single meeting by ID
export const fetchMeetingById = createAsyncThunk(
  'meetings/fetchMeetingById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/meetings/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update a meeting
export const updateMeeting = createAsyncThunk(
  'meetings/updateMeeting',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/action-tracker/meetings/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete a meeting
export const deleteMeeting = createAsyncThunk(
  'meetings/deleteMeeting',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/action-tracker/meetings/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update meeting status
export const updateMeetingStatus = createAsyncThunk(
  'meetings/updateMeetingStatus',
  async ({ id, status, comment }, { rejectWithValue }) => {
    try {
      const response = await api.patch(
        `/action-tracker/meetings/${id}/status?status=${status}&comment=${comment || ''}`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Add minutes to meeting
export const addMeetingMinutes = createAsyncThunk(
  'meetings/addMeetingMinutes',
  async ({ id, minutesData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/meetings/${id}/minutes`, minutesData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch meeting minutes
export const fetchMeetingMinutes = createAsyncThunk(
  'meetings/fetchMeetingMinutes',
  async ({ id, params = {} }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/meetings/${id}/minutes`, { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch meeting participants
export const fetchMeetingParticipants = createAsyncThunk(
  'meetings/fetchMeetingParticipants',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/meetings/${id}/participants`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch meeting status options
export const fetchMeetingStatusOptions = createAsyncThunk(
  'meetings/fetchMeetingStatusOptions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/meeting-statuses/');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// ==================== Slice ====================

const initialState = {
  meetings: {
    items: [],
    total: 0,
    pages: 1,
    page: 1,
    limit: 12,
  },
  currentMeeting: null,
  currentMinutes: [],
  currentParticipants: [],
  statusOptions: [],
  filters: {
    search: '',
    status: '',
    upcoming: false,
    dateFrom: null,
    dateTo: null,
  },
  isLoading: false,
  error: null,
  success: false,
  updateSuccess: false,
  statusHistory: [],
};

const meetingSlice = createSlice({
  name: 'meetings',
  initialState,
  reducers: {

    clearUpdateSuccess: (state) => {
      state.updateSuccess = false;
    },
    
    clearMeetingState: (state) => {
      state.currentMeeting = null;
      state.currentMinutes = [];
      state.currentParticipants = [];
      state.isLoading = false;
      state.error = null;
      state.success = false;
    },
    clearMeetings: (state) => {
      state.meetings.items = [];
      state.meetings.total = 0;
      state.meetings.pages = 1;
      state.meetings.page = 1;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.success = false;
    },
    setMeetingPage: (state, action) => {
      state.meetings.page = action.payload;
    },
    setMeetingLimit: (state, action) => {
      state.meetings.limit = action.payload;
    },
    // Filter reducers
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.meetings.page = 1; // Reset to first page when filters change
    },
    resetFilters: (state) => {
      state.filters = {
        search: '',
        status: '',
        upcoming: false,
        dateFrom: null,
        dateTo: null,
      };
      state.meetings.page = 1;
    },
    setSearchFilter: (state, action) => {
      state.filters.search = action.payload;
      state.meetings.page = 1;
    },
    setStatusFilter: (state, action) => {
      state.filters.status = action.payload;
      state.meetings.page = 1;
    },
    setUpcomingFilter: (state, action) => {
      state.filters.upcoming = action.payload;
      state.meetings.page = 1;
    },
    setDateRangeFilter: (state, action) => {
      state.filters.dateFrom = action.payload.dateFrom;
      state.filters.dateTo = action.payload.dateTo;
      state.meetings.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      // ========== Create Meeting ==========
      .addCase(createMeeting.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createMeeting.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentMeeting = action.payload;
        state.success = true;
        state.meetings.items.unshift(action.payload);
        state.meetings.total += 1;
      })
      .addCase(createMeeting.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.success = false;
      })

      // ========== Fetch Meetings ==========
      .addCase(fetchMeetings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMeetings.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload && typeof action.payload === 'object') {
          state.meetings = {
            items: action.payload.items || action.payload || [],
            total: action.payload.total || (Array.isArray(action.payload) ? action.payload.length : 0),
            pages: action.payload.pages || 1,
            page: action.payload.page || 1,
            limit: action.payload.limit || 12,
          };
        }
      })
      .addCase(fetchMeetings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // ========== Fetch Meeting By ID ==========
      .addCase(fetchMeetingById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMeetingById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentMeeting = action.payload;
      })
      .addCase(fetchMeetingById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // ========== Update Meeting ==========
      .addCase(updateMeeting.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateMeeting.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentMeeting = action.payload;
        const index = state.meetings.items.findIndex(m => m.id === action.payload.id);
        if (index !== -1) {
          state.meetings.items[index] = action.payload;
        }
        state.success = true;
      })
      .addCase(updateMeeting.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // ========== Delete Meeting ==========
      .addCase(deleteMeeting.fulfilled, (state, action) => {
        state.meetings.items = state.meetings.items.filter(m => m.id !== action.payload);
        state.meetings.total = Math.max(0, state.meetings.total - 1);
        if (state.currentMeeting?.id === action.payload) {
          state.currentMeeting = null;
        }
      })

      // ========== Update Meeting Status ==========
      .addCase(updateMeetingStatus.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateMeetingStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentMeeting = action.payload;
        const index = state.meetings.items.findIndex(m => m.id === action.payload.id);
        if (index !== -1) {
          state.meetings.items[index] = action.payload;
        }
        state.success = true;
      })
      .addCase(updateMeetingStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // ========== Add Meeting Minutes ==========
      .addCase(addMeetingMinutes.fulfilled, (state, action) => {
        state.currentMinutes.unshift(action.payload);
      })

      // ========== Fetch Meeting Minutes ==========
      .addCase(fetchMeetingMinutes.fulfilled, (state, action) => {
        state.currentMinutes = action.payload.items || action.payload || [];
      })

      // ========== Fetch Meeting Participants ==========
      .addCase(fetchMeetingParticipants.fulfilled, (state, action) => {
        state.currentParticipants = action.payload.items || action.payload || [];
      })

      // ========== Fetch Meeting Status Options ==========
      .addCase(fetchMeetingStatusOptions.fulfilled, (state, action) => {
        state.statusOptions = action.payload.items || action.payload || [];
      });
  },
});


// ==================== Filtered Meetings Selector ====================
export const selectFilteredMeetings = (state) => {
  const { items } = state.meetings.meetings;
  const { search, status, upcoming, dateFrom, dateTo } = state.meetings.filters;
  
  let filtered = [...items];
  
  // Filter by search term
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (meeting) =>
        meeting.title?.toLowerCase().includes(searchLower) ||
        meeting.description?.toLowerCase().includes(searchLower) ||
        meeting.location_text?.toLowerCase().includes(searchLower)
    );
  }
  
  // Filter by status
  if (status) {
    filtered = filtered.filter((meeting) => meeting.status?.short_name === status);
  }
  
  // Filter by upcoming
  if (upcoming) {
    const now = new Date();
    filtered = filtered.filter((meeting) => new Date(meeting.meeting_date) >= now);
  }
  
  // Filter by date range
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    filtered = filtered.filter((meeting) => new Date(meeting.meeting_date) >= fromDate);
  }
  
  if (dateTo) {
    const toDate = new Date(dateTo);
    filtered = filtered.filter((meeting) => new Date(meeting.meeting_date) <= toDate);
  }
  
  return filtered;
};

export const selectMeetingsHasMore = (state) => {
  const { page, pages } = state.meetings.meetings;
  return page < pages;
};
// ==================== Selectors ====================
export const selectAllMeetings = (state) => state.meetings.meetings.items;
export const selectCurrentMeeting = (state) => state.meetings.currentMeeting;
export const selectMeetingsLoading = (state) => state.meetings.isLoading;
export const selectMeetingsError = (state) => state.meetings.error;
export const selectMeetingError = (state) => state.meetings.error; // Alias for consistency

export const selectMeetingSuccess = (state) => state.meetings.success;
export const selectMeetingStatusOptions = (state) => state.meetings.statusOptions;
export const selectMeetingsFilters = (state) => state.meetings.filters;
export const selectMeetingPagination = (state) => ({
  total: state.meetings.meetings.total,
  pages: state.meetings.meetings.pages,
  page: state.meetings.meetings.page,
  limit: state.meetings.meetings.limit,
});

export const selectUpdateSuccess = (state) => state.meetings.updateSuccess;


// ==================== Statistics Selector ====================
// ==================== Statistics Selector (Fixed) ====================
export const selectMeetingsStatistics = (state) => {
  const { items } = state.meetings.meetings;
  
  if (!items || items.length === 0) {
    return {
      total: 0,
      scheduled: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
      inProgress: 0,
      byStatus: {},
      byMonth: {},
      avgParticipants: 0,
      totalParticipants: 0,
    };
  }
  
  const now = new Date();
  const stats = {
    total: items.length,
    scheduled: 0,
    ongoing: 0,
    completed: 0,
    cancelled: 0,
    inProgress: 0,
    byStatus: {},
    byMonth: {},
    totalParticipants: 0,
    avgParticipants: 0,
  };
  
  let participantsSum = 0;
  
  items.forEach((meeting) => {
    const meetingDate = new Date(meeting.meeting_date);
    const meetingEndTime = meeting.end_time ? new Date(meeting.end_time) : null;
    
    // Get status - try different possible field names
    let status = 'unknown';
    if (meeting.status) {
      status = meeting.status.short_name || meeting.status.code || meeting.status.name || 'unknown';
    } else if (meeting.status_name) {
      status = meeting.status_name;
    } else if (meeting.status_code) {
      status = meeting.status_code;
    }
    
    // Count by status
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    
    // Determine meeting state
    if (status === 'completed' || status === 'done' || status === 'closed') {
      stats.completed++;
    } else if (status === 'cancelled' || status === 'canceled') {
      stats.cancelled++;
    } else if (meetingDate > now) {
      stats.scheduled++;
    } else if (meetingDate <= now && (!meetingEndTime || meetingEndTime >= now)) {
      stats.ongoing++;
    } else if (meetingDate <= now && meetingEndTime && meetingEndTime < now) {
      stats.completed++;
    } else {
      stats.scheduled++;
    }
    
    // Count participants
    const participantCount = meeting.participants?.length || 
                            meeting.participants_count || 
                            meeting.custom_participants?.length || 0;
    participantsSum += participantCount;
    
    // Count by month (for charts)
    const monthKey = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
    stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
  });
  
  stats.totalParticipants = participantsSum;
  stats.avgParticipants = stats.total > 0 ? Math.round(participantsSum / stats.total) : 0;
  
  return stats;
};

export const selectMeetingsTotal = (state) => state.meetings.meetings.total;

// ==================== Status Option Selector ====================
export const selectStatusOption = (state, statusCode) => {
  const options = state.meetings.statusOptions;
  if (!options || options.length === 0) return null;
  
  return options.find(
    (option) => option.code === statusCode || option.short_name === statusCode
  );
};

export const selectStatusOptions = (state) => state.meetings.statusOptions;


// ==================== Upcoming Meetings Selector ====================
export const selectUpcomingMeetings = (state) => {
  const { items } = state.meetings.meetings;
  if (!items || items.length === 0) return [];
  
  const now = new Date();
  return items
    .filter((meeting) => new Date(meeting.meeting_date) >= now)
    .sort((a, b) => new Date(a.meeting_date) - new Date(b.meeting_date));
};

// ==================== Exports ====================
export const { 
  clearMeetingState, 
  clearMeetings,
  clearError, 
  clearSuccess,
  clearUpdateSuccess,
  setMeetingPage,
  setMeetingLimit,
  setFilters,
  resetFilters,
  setSearchFilter,
  setStatusFilter,
  setUpcomingFilter,
  setDateRangeFilter,
} = meetingSlice.actions;

export default meetingSlice.reducer;