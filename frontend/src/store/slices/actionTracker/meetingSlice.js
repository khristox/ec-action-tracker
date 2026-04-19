// src/store/slices/actionTracker/meetingSlice.js
import { createSlice, createAsyncThunk, createSelector, createAction } from '@reduxjs/toolkit';
import api from '../../../services/api';

// ==================== Types & Constants ====================

const DEFAULT_PAGINATION = {
  items: [],
  total: 0,
  pages: 1,
  page: 1,
  limit: 12,
};

const DEFAULT_FILTERS = {
  search: '',
  status: '',
  priority: '',
  upcoming: false,
  dateFrom: null,
  dateTo: null,
};

const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5 minutes
  MAX_ITEMS: 100,
  ENABLED: true,
};

const STATUS_COLOR_MAP = {
  // Meeting Statuses
  PENDING: '#F59E0B',
  STARTED: '#3B82F6',
  ENDED: '#10B981',
  AWAITING: '#8B5CF6',
  CLOSED: '#6B7280',
  CANCELLED: '#EF4444',
  
  // Action Statuses
  scheduled: '#3B82F6',
  ongoing: '#F59E0B',
  in_progress: '#3B82F6',
  completed: '#10B981',
  cancelled: '#EF4444',
  postponed: '#8B5CF6',
  overdue: '#EF4444',
  blocked: '#6B7280',
  not_started: '#9CA3AF',
};

const PRIORITY_COLORS = {
  1: { bg: '#FEE2E2', text: '#EF4444', label: 'High' },
  2: { bg: '#FEF3C7', text: '#F59E0B', label: 'Medium' },
  3: { bg: '#D1FAE5', text: '#10B981', label: 'Low' },
  4: { bg: '#E0E7FF', text: '#6366F1', label: 'Lowest' },
};

const INITIAL_STATE = {
  meetings: { ...DEFAULT_PAGINATION },
  currentMeeting: null,
  currentMinutes: { items: [], total: 0 },
  currentParticipants: { items: [], total: 0 },
  currentActions: { items: [], total: 0 },
  statusOptions: [],
  priorityOptions: [],
  filters: { ...DEFAULT_FILTERS },
  ui: {
    isLoading: false,
    isSubmitting: false,
    error: null,
    minutesError: null,
    success: false,
    updateSuccess: false,
    deleteSuccess: false,
  },
  cache: {
    meetings: new Map(),
    attributes: null,
    timestamp: null,
  },
  statusHistory: [],
};

// ==================== Helper Functions ====================

const handleApiError = (error) => {
  if (error.response?.data?.detail) {
    return typeof error.response.data.detail === 'string' 
      ? error.response.data.detail 
      : error.response.data.detail.join(', ');
  }
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return 'An unexpected error occurred';
};

const updateMeetingInList = (items, updatedMeeting) => {
  const index = items.findIndex(m => m.id === updatedMeeting.id);
  if (index === -1) return items;
  
  const newItems = [...items];
  newItems[index] = updatedMeeting;
  return newItems;
};

const addMeetingToList = (items, newMeeting, maxItems = CACHE_CONFIG.MAX_ITEMS) => {
  return [newMeeting, ...items].slice(0, maxItems);
};

const removeMeetingFromList = (items, meetingId) => {
  return items.filter(m => m.id !== meetingId);
};

const validateMeetingData = (meetingData) => {
  const errors = [];
  if (!meetingData.title?.trim()) errors.push('Title is required');
  if (!meetingData.meeting_date) errors.push('Meeting date is required');
  if (meetingData.meeting_date && new Date(meetingData.meeting_date) < new Date()) {
    errors.push('Meeting date cannot be in the past');
  }
  return errors;
};

const processStatusOptions = (attributes) => {
  const meetingStatusAttr = attributes.find(attr => attr.code === 'MEETING_STATUS');
  if (meetingStatusAttr?.options) {
    return meetingStatusAttr.options.map(opt => ({
      id: opt.value,
      value: opt.value,
      label: opt.label,
      code: opt.code,
      shortName: opt.short_name,
      sortOrder: opt.sort_order,
      color: STATUS_COLOR_MAP[opt.value] || STATUS_COLOR_MAP[opt.code] || '#6B7280',
    })).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  
  // Fallback: filter attributes that start with MEETING_STATUS_
  return attributes
    .filter(attr => attr.code?.startsWith('MEETING_STATUS_'))
    .map(attr => ({
      id: attr.id,
      value: attr.short_name || attr.code,
      label: attr.name?.replace('Meeting Status - ', '') || attr.name,
      code: attr.code,
      shortName: attr.short_name,
      sortOrder: attr.sort_order,
      color: STATUS_COLOR_MAP[attr.short_name] || STATUS_COLOR_MAP[attr.code] || '#6B7280',
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

const processPriorityOptions = (attributes) => {
  const priorityAttr = attributes.find(attr => attr.code === 'ACTION_PRIORITY');
  if (!priorityAttr?.options) return [];
  
  return priorityAttr.options.map(opt => ({
    value: parseInt(opt.value) || opt.value,
    label: opt.label,
    color: PRIORITY_COLORS[opt.value] || PRIORITY_COLORS[2],
    daysToComplete: opt.days_to_complete,
    sortOrder: opt.sort_order,
  })).sort((a, b) => a.sortOrder - b.sortOrder);
};

// ==================== Async Thunks ====================

// Fetch all attributes for Action Tracker
export const fetchActionTrackerAttributes = createAsyncThunk(
  'meetings/fetchActionTrackerAttributes',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { meetings } = getState();
      const now = Date.now();
      
      // Check cache
      if (CACHE_CONFIG.ENABLED && meetings.cache.timestamp && 
          (now - meetings.cache.timestamp) < CACHE_CONFIG.TTL) {
        return { fromCache: true };
      }
      
      const response = await api.get('/attribute-groups/ACTION_TRACKER/attributes');
      const allAttributes = response.data.items || response.data.data || response.data || [];
      
      return {
        fromCache: false,
        statusOptions: processStatusOptions(allAttributes),
        priorityOptions: processPriorityOptions(allAttributes),
        timestamp: now,
      };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Fetch meeting status options (legacy support)
export const fetchMeetingStatusOptions = createAsyncThunk(
  'meetings/fetchMeetingStatusOptions',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const result = await dispatch(fetchActionTrackerAttributes()).unwrap();
      return result.statusOptions || [];
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Create a new meeting
export const createMeeting = createAsyncThunk(
  'meetings/createMeeting',
  async (meetingData, { rejectWithValue }) => {
    try {
      console.log('Creating meeting with data:', meetingData);
      const response = await api.post('/action-tracker/meetings/', meetingData);
      console.log('Create meeting response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Create meeting error:', error.response?.data);
      return rejectWithValue(error.response?.data?.detail || error.message);
    }
  }
);

// Fetch all meetings with pagination and filtering
export const fetchMeetings = createAsyncThunk(
  'meetings/fetchMeetings',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const { meetings } = getState();
      const mergedParams = {
        page: meetings.meetings.page,
        limit: meetings.meetings.limit,
        ...meetings.filters,
        ...params,
      };
      
      // Clean parameters
      Object.keys(mergedParams).forEach(key => {
        if (mergedParams[key] == null || mergedParams[key] === '') {
          delete mergedParams[key];
        }
      });
      
      const response = await api.get('/action-tracker/meetings/', { params: mergedParams });
      
      return {
        items: response.data.items || response.data || [],
        total: response.data.total || 0,
        pages: response.data.pages || 1,
        page: response.data.page || mergedParams.page,
        limit: response.data.limit || mergedParams.limit,
      };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Fetch a single meeting by ID
export const fetchMeetingById = createAsyncThunk(
  'meetings/fetchMeetingById',
  async (id, { rejectWithValue }) => {
    try {
      if (!id) throw new Error('Meeting ID is required');
      const response = await api.get(`/action-tracker/meetings/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Update a meeting
// In meetingSlice.js
export const updateMeeting = createAsyncThunk(
  'meetings/updateMeeting',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/action-tracker/meetings/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
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
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Update meeting status
export const updateMeetingStatus = createAsyncThunk(
  'meetings/updateMeetingStatus',
  async ({ id, status, comment }, { rejectWithValue }) => {
    try {
      const response = await api.patch(
        `/action-tracker/meetings/${id}/status`,
        null,
        { params: { status, comment: comment || '' } }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
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
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Fetch meeting minutes
export const fetchMeetingMinutes = createAsyncThunk(
  'meetings/fetchMeetingMinutes',
  async (meetingId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/minutes`);
      
      let minutesData = [];
      const data = response.data;
      
      if (Array.isArray(data)) {
        minutesData = data;
      } else if (data && typeof data === 'object') {
        if (data.id && (data.topic || data.title)) {
          minutesData = [data];
        } else if (data.items) {
          minutesData = data.items;
        } else if (data.data) {
          minutesData = Array.isArray(data.data) ? data.data : [data.data];
        }
      }
      
      return {
        items: minutesData,
        total: minutesData.length
      };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Create meeting minutes
export const createMeetingMinutes = createAsyncThunk(
  'meetings/createMeetingMinutes',
  async ({ meetingId, data }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/meetings/${meetingId}/minutes`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Delete meeting minutes
export const deleteMeetingMinutes = createAsyncThunk(
  'meetings/deleteMeetingMinutes',
  async ({ meetingId, minutesId }, { rejectWithValue }) => {
    try {
      await api.delete(`/action-tracker/meetings/${meetingId}/minutes/${minutesId}`);
      return minutesId;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Update meeting minutes
export const updateMeetingMinutes = createAsyncThunk(
  'meetings/updateMeetingMinutes',
  async ({ meetingId, minutesId, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/action-tracker/meetings/${meetingId}/minutes/${minutesId}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Fetch meeting participants
export const fetchMeetingParticipants = createAsyncThunk(
  'meetings/fetchMeetingParticipants',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/meetings/${id}/participants`);
      const items = response.data.items || response.data.data || response.data || [];
      const total = response.data.total || items.length;
      
      return {
        items: Array.isArray(items) ? items : [],
        total: total,
      };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Fetch meeting actions
export const fetchMeetingActions = createAsyncThunk(
  'meetings/fetchMeetingActions',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/meetings/${id}/actions`);
      const items = response.data.items || response.data.data || response.data || [];
      const total = response.data.total || items.length;
      
      return {
        items: Array.isArray(items) ? items : [],
        total: total,
      };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Export meetings
export const exportMeetings = createAsyncThunk(
  'meetings/exportMeetings',
  async (format = 'csv', { rejectWithValue, getState }) => {
    try {
      const { meetings } = getState();
      const params = {
        format,
        ...meetings.filters,
      };
      
      const response = await api.get('/action-tracker/meetings/export', {
        params,
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meetings_export_${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true, format };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// ==================== Slice ====================

const meetingSlice = createSlice({
  name: 'meetings',
  initialState: INITIAL_STATE,
  reducers: {
    // UI Actions
    clearUpdateSuccess: (state) => {
      state.ui.updateSuccess = false;
    },
    clearDeleteSuccess: (state) => {
      state.ui.deleteSuccess = false;
    },
    clearError: (state) => {
      state.ui.error = null;
    },
    clearSuccess: (state) => {
      state.ui.success = false;
    },
    resetUiState: (state) => {
      state.ui = INITIAL_STATE.ui;
    },
    
    // Clear minutes error
    clearMinutesError: (state) => {
      state.ui.minutesError = null;
    },
    
    // Meeting Management
    clearMeetingState: (state) => {
      state.currentMeeting = null;
      state.currentMinutes = { items: [], total: 0 };
      state.currentParticipants = { items: [], total: 0 };
      state.currentActions = { items: [], total: 0 };
      state.ui.isLoading = false;
      state.ui.error = null;
      state.ui.success = false;
      state.ui.minutesError = null;
    },
    clearMeetings: (state) => {
      state.meetings = { ...DEFAULT_PAGINATION };
      state.ui.error = null;
    },
    
    // Pagination
    setMeetingPage: (state, action) => {
      state.meetings.page = action.payload;
    },
    setMeetingLimit: (state, action) => {
      state.meetings.limit = action.payload;
      state.meetings.page = 1;
    },
    
    // Filter Management
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.meetings.page = 1;
    },
    resetFilters: (state) => {
      state.filters = { ...DEFAULT_FILTERS };
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
    setPriorityFilter: (state, action) => {
      state.filters.priority = action.payload;
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
    
    // Cache Management
    clearCache: (state) => {
      state.cache.meetings.clear();
      state.cache.attributes = null;
      state.cache.timestamp = null;
    },
    
    // Optimistic Updates
    optimisticUpdateMeeting: (state, action) => {
      const { id, updates } = action.payload;
      const index = state.meetings.items.findIndex(m => m.id === id);
      if (index !== -1) {
        state.meetings.items[index] = { ...state.meetings.items[index], ...updates };
      }
      if (state.currentMeeting?.id === id) {
        state.currentMeeting = { ...state.currentMeeting, ...updates };
      }
    },
    
    // Local minutes management
    addMinutesLocally: (state, action) => {
      const newMinutes = action.payload;
      state.currentMinutes.items = [newMinutes, ...state.currentMinutes.items];
      state.currentMinutes.total += 1;
    },
    removeMinutesLocally: (state, action) => {
      const minutesId = action.payload;
      state.currentMinutes.items = state.currentMinutes.items.filter(m => m.id !== minutesId);
      state.currentMinutes.total = Math.max(0, state.currentMinutes.total - 1);
    },
    updateMinutesLocally: (state, action) => {
      const { id, data } = action.payload;
      const index = state.currentMinutes.items.findIndex(m => m.id === id);
      if (index !== -1) {
        state.currentMinutes.items[index] = { ...state.currentMinutes.items[index], ...data };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // ========== Fetch Action Tracker Attributes ==========
      .addCase(fetchActionTrackerAttributes.pending, (state) => {
        if (!state.statusOptions.length) {
          state.ui.isLoading = true;
        }
      })
      .addCase(fetchActionTrackerAttributes.fulfilled, (state, action) => {
        state.ui.isLoading = false;
        if (!action.payload.fromCache) {
          state.statusOptions = action.payload.statusOptions;
          state.priorityOptions = action.payload.priorityOptions;
          state.cache.timestamp = action.payload.timestamp;
        }
      })
      .addCase(fetchActionTrackerAttributes.rejected, (state, action) => {
        state.ui.isLoading = false;
        state.ui.error = action.payload;
      })

      // ========== Fetch Meeting Status Options ==========
      .addCase(fetchMeetingStatusOptions.fulfilled, (state, action) => {
        if (action.payload?.length) {
          state.statusOptions = action.payload;
        }
      })

      // ========== Create Meeting ==========
      .addCase(createMeeting.pending, (state) => {
        state.ui.isSubmitting = true;
        state.ui.success = false;
        state.ui.error = null;
      })
      .addCase(createMeeting.fulfilled, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.success = true;
        state.currentMeeting = action.payload;
        state.ui.error = null;
        
        if (action.payload) {
          state.meetings.items = [action.payload, ...state.meetings.items];
          state.meetings.total += 1;
        }
        
        console.log('Meeting created successfully in state:', action.payload);
      })
      .addCase(createMeeting.rejected, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.success = false;
        state.ui.error = action.payload;
        console.error('Meeting creation rejected:', action.payload);
      })

      // ========== Fetch Meetings ==========
      .addCase(fetchMeetings.pending, (state) => {
        state.ui.isLoading = true;
        state.ui.error = null;
      })
      .addCase(fetchMeetings.fulfilled, (state, action) => {
        state.ui.isLoading = false;
        state.meetings = {
          items: action.payload.items,
          total: action.payload.total,
          pages: action.payload.pages,
          page: action.payload.page,
          limit: action.payload.limit,
        };
      })
      .addCase(fetchMeetings.rejected, (state, action) => {
        state.ui.isLoading = false;
        state.ui.error = action.payload;
      })

      // ========== Fetch Meeting By ID ==========
      .addCase(fetchMeetingById.pending, (state) => {
        state.ui.isLoading = true;
        state.ui.error = null;
      })
      .addCase(fetchMeetingById.fulfilled, (state, action) => {
        state.ui.isLoading = false;
        state.currentMeeting = action.payload;
      })
      .addCase(fetchMeetingById.rejected, (state, action) => {
        state.ui.isLoading = false;
        state.ui.error = action.payload;
      })

      // ========== Update Meeting ==========
      .addCase(updateMeeting.pending, (state) => {
        state.ui.isSubmitting = true;
        state.ui.error = null;
      })
      .addCase(updateMeeting.fulfilled, (state, action) => {
        state.ui.isSubmitting = false;
        state.currentMeeting = action.payload;
        state.meetings.items = updateMeetingInList(state.meetings.items, action.payload);
        state.ui.updateSuccess = true;
      })
      .addCase(updateMeeting.rejected, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.error = action.payload;
      })

      // ========== Delete Meeting ==========
      .addCase(deleteMeeting.pending, (state) => {
        state.ui.isSubmitting = true;
      })
      .addCase(deleteMeeting.fulfilled, (state, action) => {
        state.ui.isSubmitting = false;
        state.meetings.items = removeMeetingFromList(state.meetings.items, action.payload);
        state.meetings.total = Math.max(0, state.meetings.total - 1);
        state.ui.deleteSuccess = true;
        if (state.currentMeeting?.id === action.payload) {
          state.currentMeeting = null;
        }
      })
      .addCase(deleteMeeting.rejected, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.error = action.payload;
      })

      // ========== Update Meeting Status ==========
      .addCase(updateMeetingStatus.pending, (state) => {
        state.ui.isSubmitting = true;
      })
      .addCase(updateMeetingStatus.fulfilled, (state, action) => {
        state.ui.isSubmitting = false;
        state.currentMeeting = action.payload;
        state.meetings.items = updateMeetingInList(state.meetings.items, action.payload);
        state.ui.updateSuccess = true;
      })
      .addCase(updateMeetingStatus.rejected, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.error = action.payload;
      })

      // ========== Meeting Minutes ==========
      .addCase(addMeetingMinutes.pending, (state) => {
        state.ui.isSubmitting = true;
      })
      .addCase(addMeetingMinutes.fulfilled, (state, action) => {
        state.ui.isSubmitting = false;
        state.currentMinutes.items = [action.payload, ...state.currentMinutes.items];
        state.currentMinutes.total += 1;
        state.ui.success = true;
      })
      .addCase(addMeetingMinutes.rejected, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.error = action.payload;
      })
      
      .addCase(fetchMeetingMinutes.pending, (state) => {
        state.ui.isLoading = true;
        state.ui.minutesError = null;
      })
      .addCase(fetchMeetingMinutes.fulfilled, (state, action) => {
        state.ui.isLoading = false;
        state.currentMinutes = action.payload;
      })
      .addCase(fetchMeetingMinutes.rejected, (state, action) => {
        state.ui.isLoading = false;
        state.ui.minutesError = action.payload;
        state.ui.error = action.payload;
      })

      // ========== Create Meeting Minutes ==========
      .addCase(createMeetingMinutes.pending, (state) => {
        state.ui.isSubmitting = true;
        state.ui.minutesError = null;
      })
      .addCase(createMeetingMinutes.fulfilled, (state, action) => {
        state.ui.isSubmitting = false;
        state.currentMinutes.items = [action.payload, ...state.currentMinutes.items];
        state.currentMinutes.total += 1;
        state.ui.success = true;
      })
      .addCase(createMeetingMinutes.rejected, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.minutesError = action.payload;
        state.ui.error = action.payload;
      })

      // ========== Delete Meeting Minutes ==========
      .addCase(deleteMeetingMinutes.pending, (state) => {
        state.ui.isSubmitting = true;
      })
      .addCase(deleteMeetingMinutes.fulfilled, (state, action) => {
        state.ui.isSubmitting = false;
        state.currentMinutes.items = state.currentMinutes.items.filter(m => m.id !== action.payload);
        state.currentMinutes.total = Math.max(0, state.currentMinutes.total - 1);
        state.ui.deleteSuccess = true;
      })
      .addCase(deleteMeetingMinutes.rejected, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.error = action.payload;
      })

      // ========== Update Meeting Minutes ==========
      .addCase(updateMeetingMinutes.pending, (state) => {
        state.ui.isSubmitting = true;
      })
      .addCase(updateMeetingMinutes.fulfilled, (state, action) => {
        state.ui.isSubmitting = false;
        const index = state.currentMinutes.items.findIndex(m => m.id === action.payload.id);
        if (index !== -1) {
          state.currentMinutes.items[index] = action.payload;
        }
        state.ui.updateSuccess = true;
      })
      .addCase(updateMeetingMinutes.rejected, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.error = action.payload;
      })

      // ========== Meeting Participants ==========
      .addCase(fetchMeetingParticipants.pending, (state) => {
        state.ui.isLoading = true;
      })
      .addCase(fetchMeetingParticipants.fulfilled, (state, action) => {
        state.ui.isLoading = false;
        state.currentParticipants = action.payload;
      })
      .addCase(fetchMeetingParticipants.rejected, (state, action) => {
        state.ui.isLoading = false;
        state.ui.error = action.payload;
      })

      // ========== Meeting Actions ==========
      .addCase(fetchMeetingActions.pending, (state) => {
        state.ui.isLoading = true;
      })
      .addCase(fetchMeetingActions.fulfilled, (state, action) => {
        state.ui.isLoading = false;
        state.currentActions = action.payload;
      })
      .addCase(fetchMeetingActions.rejected, (state, action) => {
        state.ui.isLoading = false;
        state.ui.error = action.payload;
      });
  },
});

// ==================== Memoized Selectors ====================

// Base Selectors
export const selectMeetingsState = (state) => state.meetings;
export const selectAllMeetings = (state) => state.meetings.meetings.items;
export const selectCurrentMeeting = (state) => state.meetings.currentMeeting;
export const selectMeetingsLoading = (state) => state.meetings.ui.isLoading;
export const selectMeetingsSubmitting = (state) => state.meetings.ui.isSubmitting;
export const selectMeetingsError = (state) => state.meetings.ui.error;
export const selectMeetingError = (state) => state.meetings.ui.error;
export const selectMeetingSuccess = (state) => state.meetings.ui.success;
export const selectUpdateSuccess = (state) => state.meetings.ui.updateSuccess;
export const selectDeleteSuccess = (state) => state.meetings.ui.deleteSuccess;
export const selectMeetingStatusOptions = (state) => state.meetings.statusOptions;
export const selectStatusOptions = (state) => state.meetings.statusOptions;
export const selectMeetingPriorityOptions = (state) => state.meetings.priorityOptions;
export const selectMeetingsFilters = (state) => state.meetings.filters;
export const selectMeetingPagination = (state) => ({
  total: state.meetings.meetings.total,
  pages: state.meetings.meetings.pages,
  page: state.meetings.meetings.page,
  limit: state.meetings.meetings.limit,
});
export const selectMeetingsTotal = (state) => state.meetings.meetings.total;

// Minutes Selectors
export const selectMeetingMinutes = (state) => state.meetings.currentMinutes.items;
export const selectMeetingMinutesTotal = (state) => state.meetings.currentMinutes.total;
export const selectMinutesLoading = (state) => state.meetings.ui.isLoading;
export const selectMinutesError = (state) => state.meetings.ui.minutesError;

// Participants Selectors
export const selectMeetingParticipants = (state) => state.meetings.currentParticipants.items;
export const selectMeetingParticipantsTotal = (state) => state.meetings.currentParticipants.total;

// Actions Selectors
export const selectMeetingActions = (state) => state.meetings.currentActions.items;
export const selectMeetingActionsTotal = (state) => state.meetings.currentActions.total;

// Derived Selectors
export const selectFilteredMeetings = createSelector(
  [selectAllMeetings, selectMeetingsFilters],
  (items, filters) => {
    if (!items?.length) return [];
    
    let filtered = [...items];
    const { search, status, priority, upcoming, dateFrom, dateTo } = filters;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (meeting) =>
          meeting.title?.toLowerCase().includes(searchLower) ||
          meeting.description?.toLowerCase().includes(searchLower) ||
          meeting.location_text?.toLowerCase().includes(searchLower) ||
          meeting.agenda?.toLowerCase().includes(searchLower)
      );
    }
    
    if (status) {
      filtered = filtered.filter((meeting) => 
        meeting.status?.short_name === status || 
        meeting.status === status ||
        meeting.status?.code === status
      );
    }
    
    if (priority) {
      filtered = filtered.filter((meeting) => 
        meeting.priority === priority || 
        meeting.priority_level === priority
      );
    }
    
    if (upcoming) {
      const now = new Date();
      filtered = filtered.filter((meeting) => new Date(meeting.meeting_date) >= now);
    }
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((meeting) => new Date(meeting.meeting_date) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((meeting) => new Date(meeting.meeting_date) <= toDate);
    }
    
    return filtered;
  }
);

export const selectUpcomingMeetings = createSelector(
  [selectAllMeetings],
  (items) => {
    if (!items?.length) return [];
    
    const now = new Date();
    return items
      .filter((meeting) => new Date(meeting.meeting_date) >= now)
      .sort((a, b) => new Date(a.meeting_date) - new Date(b.meeting_date));
  }
);

export const selectRecentMeetings = createSelector(
  [selectAllMeetings, (_, days = 7) => days],
  (items, days) => {
    if (!items?.length) return [];
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return items
      .filter((meeting) => new Date(meeting.meeting_date) >= cutoffDate)
      .sort((a, b) => new Date(b.meeting_date) - new Date(a.meeting_date));
  }
);

export const selectMeetingsByStatus = createSelector(
  [selectAllMeetings, (_, status) => status],
  (items, status) => {
    if (!items?.length) return [];
    return items.filter(meeting => 
      meeting.status === status || 
      meeting.status?.short_name === status ||
      meeting.status?.code === status
    );
  }
);

export const selectMeetingById = createSelector(
  [selectAllMeetings, (_, id) => id],
  (items, id) => items.find(meeting => meeting.id === id)
);

export const selectMeetingsStatistics = createSelector(
  [selectAllMeetings],
  (items) => {
    if (!items?.length) {
      return {
        total: 0,
        scheduled: 0,
        ongoing: 0,
        completed: 0,
        cancelled: 0,
        byStatus: {},
        byMonth: {},
        avgParticipants: 0,
        totalParticipants: 0,
        completionRate: 0,
      };
    }
    
    const now = new Date();
    const stats = {
      total: items.length,
      scheduled: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
      byStatus: {},
      byMonth: {},
      totalParticipants: 0,
      avgParticipants: 0,
      completionRate: 0,
    };
    
    let participantsSum = 0;
    
    items.forEach((meeting) => {
      const meetingDate = new Date(meeting.meeting_date);
      const meetingEndTime = meeting.end_time ? new Date(meeting.end_time) : null;
      
      let status = 'unknown';
      if (meeting.status) {
        status = meeting.status.short_name || meeting.status.code || meeting.status.name || 'unknown';
      } else if (meeting.status_name) {
        status = meeting.status_name;
      } else if (meeting.status_code) {
        status = meeting.status_code;
      }
      
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      if (['completed', 'done', 'closed', 'ENDED'].includes(status)) {
        stats.completed++;
      } else if (['cancelled', 'canceled', 'CANCELLED'].includes(status)) {
        stats.cancelled++;
      } else if (meetingDate > now) {
        stats.scheduled++;
      } else if (meetingDate <= now && (!meetingEndTime || meetingEndTime >= now)) {
        stats.ongoing++;
      } else {
        stats.completed++;
      }
      
      const participantCount = meeting.participants?.length || 
                              meeting.participants_count || 
                              meeting.custom_participants?.length || 0;
      participantsSum += participantCount;
      
      const monthKey = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
      stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
    });
    
    stats.totalParticipants = participantsSum;
    stats.avgParticipants = stats.total > 0 ? Math.round(participantsSum / stats.total) : 0;
    stats.completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    
    return stats;
  }
);

export const selectMeetingsHasMore = createSelector(
  [selectMeetingPagination],
  ({ page, pages }) => page < pages
);

export const selectIsFilterApplied = createSelector(
  [selectMeetingsFilters],
  (filters) => {
    return !!(
      filters.search ||
      filters.status ||
      filters.priority ||
      filters.upcoming ||
      filters.dateFrom ||
      filters.dateTo
    );
  }
);

export const selectStatusOption = createSelector(
  [selectMeetingStatusOptions, (_, statusCode) => statusCode],
  (options, statusCode) => {
    if (!options?.length) return null;
    return options.find(opt => 
      opt.value === statusCode || 
      opt.code === statusCode || 
      opt.shortName === statusCode
    );
  }
);

export const selectStatusColor = createSelector(
  [selectStatusOption],
  (option) => option?.color || '#6B7280'
);

export const selectMinutesForMeeting = createSelector(
  [selectMeetingMinutes],
  (minutes) => minutes || []
);

export const selectParticipantsForMeeting = createSelector(
  [selectMeetingParticipants],
  (participants) => participants || []
);

export const selectActionsForMeeting = createSelector(
  [selectMeetingActions],
  (actions) => actions || []
);

// ==================== Exports ====================
export const { 
  clearMeetingState, 
  clearMeetings,
  clearError, 
  clearSuccess,
  clearUpdateSuccess,
  clearDeleteSuccess,
  resetUiState,
  setMeetingPage,
  setMeetingLimit,
  setFilters,
  resetFilters,
  setSearchFilter,
  setStatusFilter,
  setPriorityFilter,
  setUpcomingFilter,
  setDateRangeFilter,
  clearCache,
  optimisticUpdateMeeting,
  addMinutesLocally,
  removeMinutesLocally,
  updateMinutesLocally,
  clearMinutesError,
} = meetingSlice.actions;

export default meetingSlice.reducer;