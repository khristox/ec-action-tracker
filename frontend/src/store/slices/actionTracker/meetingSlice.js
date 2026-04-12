// frontend/src/store/slices/actionTracker/meetingSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { createSelector } from '@reduxjs/toolkit';
import api from '../../../services/api';

// ==================== HELPER FUNCTIONS ====================

const isValidUUID = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const handleApiError = (error, defaultMessage) => {
  console.error('API Error:', error);
  return error.response?.data?.detail || error.response?.data?.message || error.message || defaultMessage;
};

// ==================== ASYNC THUNKS ====================

// Fetch all meetings with pagination and filtering
export const fetchMeetings = createAsyncThunk(
  'meetings/fetchAll',
  async ({ page = 1, limit = 12, search = '', status = '', sortBy = 'meeting_date', sortOrder = 'desc' } = {}, { rejectWithValue }) => {
    try {
      const params = {
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (search) params.search = search;
      if (status) params.status = status;
      
      const response = await api.get('/action-tracker/meetings/', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error, 'Failed to fetch meetings'));
    }
  }
);

// Fetch meeting by ID
export const fetchMeetingById = createAsyncThunk(
  'meetings/fetchById',
  async (id, { rejectWithValue }) => {
    if (!isValidUUID(id)) {
      return rejectWithValue('Invalid meeting ID format');
    }
    
    try {
      const response = await api.get(`/action-tracker/meetings/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error, 'Failed to fetch meeting'));
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
      
      const meetingStatuses = attributes.filter(attr => 
        attr.code?.startsWith('MEETING_STATUS_')
      );
      
      if (meetingStatuses.length === 0) {
        return getFallbackStatusOptions();
      }
      
      const options = meetingStatuses.map(status => ({
        value: status.short_name?.toLowerCase() || status.code?.replace('MEETING_STATUS_', '').toLowerCase(),
        label: status.name?.replace('Meeting Status - ', ''),
        originalLabel: status.name,
        code: status.code,
        id: status.id,
        shortName: status.short_name,
        color: status.extra_metadata?.color || getDefaultColorForStatus(status.code),
        icon: status.extra_metadata?.icon || getDefaultIconForStatus(status.code),
        description: status.extra_metadata?.description || '',
        sortOrder: status.sort_order || 0
      })).sort((a, b) => a.sortOrder - b.sortOrder);
      
      return options;
    } catch (error) {
      console.error('Error fetching status options:', error);
      return getFallbackStatusOptions();
    }
  }
);

// Helper functions for fallback
const getDefaultColorForStatus = (code) => {
  const colors = {
    'MEETING_STATUS_SCHEDULED': '#3B82F6',
    'MEETING_STATUS_ONGOING': '#F59E0B',
    'MEETING_STATUS_COMPLETED': '#10B981',
    'MEETING_STATUS_CANCELLED': '#EF4444',
    'MEETING_STATUS_POSTPONED': '#8B5CF6'
  };
  return colors[code] || '#64748B';
};

const getDefaultIconForStatus = (code) => {
  const icons = {
    'MEETING_STATUS_SCHEDULED': 'event',
    'MEETING_STATUS_ONGOING': 'play_circle',
    'MEETING_STATUS_COMPLETED': 'check_circle',
    'MEETING_STATUS_CANCELLED': 'cancel',
    'MEETING_STATUS_POSTPONED': 'pending'
  };
  return icons[code] || 'schedule';
};

const getFallbackStatusOptions = () => {
  return [
    { value: 'scheduled', label: 'Scheduled', color: '#3B82F6', icon: 'event', description: 'Meeting scheduled but not started', sortOrder: 1 },
    { value: 'ongoing', label: 'Ongoing', color: '#F59E0B', icon: 'play_circle', description: 'Meeting in progress', sortOrder: 2 },
    { value: 'completed', label: 'Completed', color: '#10B981', icon: 'check_circle', description: 'Meeting fully completed', sortOrder: 3 },
    { value: 'cancelled', label: 'Cancelled', color: '#EF4444', icon: 'cancel', description: 'Meeting cancelled', sortOrder: 4 },
    { value: 'postponed', label: 'Postponed', color: '#8B5CF6', icon: 'pending', description: 'Meeting postponed', sortOrder: 5 },
  ];
};

// Create new meeting
export const createMeeting = createAsyncThunk(
  'meetings/create',
  async (meetingData, { rejectWithValue }) => {
    try {
      const response = await api.post('/action-tracker/meetings', meetingData);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error, 'Failed to create meeting'));
    }
  }
);

// Update meeting
export const updateMeeting = createAsyncThunk(
  'meetings/update',
  async ({ id, data }, { rejectWithValue }) => {
    if (!isValidUUID(id)) {
      return rejectWithValue('Invalid meeting ID format');
    }
    
    try {
      const response = await api.put(`/action-tracker/meetings/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error, 'Failed to update meeting'));
    }
  }
);

// Delete meeting
export const deleteMeeting = createAsyncThunk(
  'meetings/delete',
  async (id, { rejectWithValue }) => {
    if (!isValidUUID(id)) {
      return rejectWithValue('Invalid meeting ID format');
    }
    
    try {
      await api.delete(`/action-tracker/meetings/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(handleApiError(error, 'Failed to delete meeting'));
    }
  }
);

// ==================== SLICE ====================

const initialState = {
  meetings: [],
  currentMeeting: null,
  statusOptions: [],
  loading: false,
  error: null,
  updating: false,
  updateSuccess: false,
  total: 0,
  page: 1,
  hasMore: true,
  filters: {
    search: '',
    status: '',
    sortBy: 'meeting_date',
    sortOrder: 'desc'
  }
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
    clearMeetings: (state) => {
      state.meetings = [];
      state.total = 0;
      state.page = 1;
      state.hasMore = true;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    updateLocalMeetingStatus: (state, action) => {
      if (state.currentMeeting) {
        state.currentMeeting.status = action.payload;
      }
      const meetingIndex = state.meetings.findIndex(m => m.id === state.currentMeeting?.id);
      if (meetingIndex !== -1) {
        state.meetings[meetingIndex].status = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Meetings
      .addCase(fetchMeetings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMeetings.fulfilled, (state, action) => {
        state.loading = false;
        const { items, total, page } = action.payload;
        state.meetings = items || [];
        state.total = total || 0;
        state.page = page || 1;
        state.hasMore = (state.meetings.length < state.total);
      })
      .addCase(fetchMeetings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
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
      .addCase(fetchMeetingStatusOptions.pending, (state) => {
        state.statusOptions = [];
      })
      .addCase(fetchMeetingStatusOptions.fulfilled, (state, action) => {
        state.statusOptions = action.payload;
      })
      
      // Create Meeting
      .addCase(createMeeting.fulfilled, (state, action) => {
        state.meetings.unshift(action.payload);
        state.total += 1;
        state.updateSuccess = true;
      })
      .addCase(createMeeting.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Update Meeting
      .addCase(updateMeeting.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateMeeting.fulfilled, (state, action) => {
        state.updating = false;
        state.currentMeeting = action.payload;
        state.updateSuccess = true;
        
        const index = state.meetings.findIndex(m => m.id === action.payload.id);
        if (index !== -1) {
          state.meetings[index] = action.payload;
        }
      })
      .addCase(updateMeeting.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })
      
      // Delete Meeting
      .addCase(deleteMeeting.fulfilled, (state, action) => {
        state.meetings = state.meetings.filter(m => m.id !== action.payload);
        state.total -= 1;
        if (state.currentMeeting?.id === action.payload) {
          state.currentMeeting = null;
        }
      })
      .addCase(deleteMeeting.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

// ==================== MEMOIZED SELECTORS ====================

// Base selectors
const selectMeetingsState = (state) => state.meetings;

// Memoized selectors
export const selectAllMeetings = createSelector(
  [selectMeetingsState],
  (meetingsState) => meetingsState.meetings || []
);

export const selectCurrentMeeting = createSelector(
  [selectMeetingsState],
  (meetingsState) => meetingsState.currentMeeting
);

export const selectMeetingLoading = createSelector(
  [selectMeetingsState],
  (meetingsState) => meetingsState.loading
);

export const selectMeetingUpdating = createSelector(
  [selectMeetingsState],
  (meetingsState) => meetingsState.updating
);

export const selectMeetingError = createSelector(
  [selectMeetingsState],
  (meetingsState) => meetingsState.error
);

export const selectUpdateSuccess = createSelector(
  [selectMeetingsState],
  (meetingsState) => meetingsState.updateSuccess
);

export const selectStatusOptions = createSelector(
  [selectMeetingsState],
  (meetingsState) => meetingsState.statusOptions || []
);

export const selectMeetingsTotal = createSelector(
  [selectMeetingsState],
  (meetingsState) => meetingsState.total
);

export const selectMeetingsHasMore = createSelector(
  [selectMeetingsState],
  (meetingsState) => meetingsState.hasMore
);

export const selectMeetingsFilters = createSelector(
  [selectMeetingsState],
  (meetingsState) => meetingsState.filters
);

// Derived selectors
export const selectFilteredMeetings = createSelector(
  [selectAllMeetings, selectMeetingsFilters],
  (meetings, filters) => {
    let filtered = [...meetings];
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(m => 
        m.title?.toLowerCase().includes(searchLower) ||
        m.description?.toLowerCase().includes(searchLower)
      );
    }
    
    if (filters.status) {
      filtered = filtered.filter(m => 
        m.status?.name?.toLowerCase() === filters.status.toLowerCase() ||
        m.status?.toLowerCase() === filters.status.toLowerCase()
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (filters.sortBy) {
        case 'meeting_date':
          aVal = new Date(a.meeting_date);
          bVal = new Date(b.meeting_date);
          break;
        case 'title':
          aVal = a.title || '';
          bVal = b.title || '';
          break;
        default:
          aVal = new Date(a.created_at);
          bVal = new Date(b.created_at);
      }
      
      if (filters.sortOrder === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      } else {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
    });
    
    return filtered;
  }
);

export const selectPaginatedMeetings = createSelector(
  [selectFilteredMeetings, (state, page, limit) => ({ page, limit })],
  (filteredMeetings, { page, limit }) => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      items: filteredMeetings.slice(start, end),
      total: filteredMeetings.length,
      page,
      limit,
      totalPages: Math.ceil(filteredMeetings.length / limit)
    };
  }
);

export const selectMeetingById = (meetingId) => createSelector(
  [selectAllMeetings],
  (meetings) => meetings.find(m => m.id === meetingId) || null
);

export const selectUpcomingMeetings = createSelector(
  [selectAllMeetings],
  (meetings) => {
    const now = new Date();
    return meetings
      .filter(m => new Date(m.meeting_date) >= now && m.status?.name?.toLowerCase() !== 'completed')
      .sort((a, b) => new Date(a.meeting_date) - new Date(b.meeting_date));
  }
);

export const selectRecentMeetings = createSelector(
  [selectAllMeetings],
  (meetings) => {
    return [...meetings]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
  }
);

export const selectMeetingsByStatus = createSelector(
  [selectAllMeetings, (state, status) => status],
  (meetings, status) => {
    if (!status) return meetings;
    return meetings.filter(m => 
      m.status?.name?.toLowerCase() === status.toLowerCase() ||
      m.status?.toLowerCase() === status.toLowerCase()
    );
  }
);

// Statistics selectors
export const selectMeetingsStatistics = createSelector(
  [selectAllMeetings],
  (meetings) => {
    const total = meetings.length;
    const scheduled = meetings.filter(m => m.status?.name?.toLowerCase() === 'scheduled').length;
    const ongoing = meetings.filter(m => m.status?.name?.toLowerCase() === 'ongoing').length;
    const completed = meetings.filter(m => m.status?.name?.toLowerCase() === 'completed').length;
    const cancelled = meetings.filter(m => m.status?.name?.toLowerCase() === 'cancelled').length;
    const totalParticipants = meetings.reduce((sum, m) => sum + (m.participants?.length || 0), 0);
    const averageParticipants = total > 0 ? Math.round(totalParticipants / total) : 0;
    
    return {
      total,
      scheduled,
      ongoing,
      completed,
      cancelled,
      totalParticipants,
      averageParticipants,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }
);

export const updateMeetingStatus = createAsyncThunk(
  'meetings/updateStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/action-tracker/meetings/${id}/`, { status });
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error, 'Failed to update status'));
    }
  }
);

// ==================== EXPORTS ====================

export const {
  clearCurrentMeeting,
  clearError,
  clearUpdateSuccess,
  clearMeetings,
  setFilters,
  resetFilters,
  updateLocalMeetingStatus,
} = meetingSlice.actions;

export default meetingSlice.reducer;