// src/store/slices/actionTracker/meetingSlice.js
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
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

// Enhanced status colors for meeting statuses
const MEETING_STATUS_COLOR_MAP = {
  pending: '#F59E0B',
  scheduled: '#3B82F6',
  started: '#10B981',
  ongoing: '#3B82F6',
  in_progress: '#3B82F6',
  ended: '#6B7280',
  completed: '#10B981',
  awaiting: '#8B5CF6',
  closed: '#6B7280',
  cancelled: '#EF4444',
};

// Enhanced status colors for action statuses
const ACTION_STATUS_COLOR_MAP = {
  pending: '#F59E0B',
  started: '#3B82F6',
  in_progress: '#3B82F6',
  awaiting: '#8B5CF6',
  awaiting_approval: '#8B5CF6',
  in_review: '#A78BFA',
  on_hold: '#6B7280',
  blocked: '#EF4444',
  completed: '#10B981',
  closed: '#059669',
  cancelled: '#DC2626',
  overdue: '#EF4444',
  ended: '#6B7280',
};

// Action status icons
const ACTION_STATUS_ICONS = {
  pending: 'HourglassEmpty',
  started: 'PlayCircle',
  in_progress: 'Pending',
  awaiting: 'WatchLater',
  awaiting_approval: 'Pending',
  in_review: 'CheckCircleOutline',
  on_hold: 'PauseCircle',
  blocked: 'CancelOutlined',
  completed: 'CheckCircle',
  closed: 'TaskAlt',
  cancelled: 'HighlightOff',
  overdue: 'Error',
  ended: 'Cancel',
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
  meetingStatusOptions: [],
  actionStatusOptions: [],
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

const removeMeetingFromList = (items, meetingId) => {
  return items.filter(m => m.id !== meetingId);
};

// Process meeting status options from ACTION_TRACKER attribute group
const processMeetingStatusOptions = (attributes) => {
  const statusAttributes = attributes.filter(attr => 
    attr.code && attr.code.includes('MEETING_STATUS_') && attr.code !== 'MEETING_STATUS'
  );
  
  return statusAttributes.map(attr => ({
    id: attr.id,
    value: attr.short_name?.toLowerCase() || attr.code?.replace('MEETING_STATUS_', '').toLowerCase(),
    label: attr.short_name?.charAt(0).toUpperCase() + attr.short_name?.slice(1).toLowerCase() || 
           attr.name?.replace('Meeting Status - ', '') || 
           attr.short_name ||
           attr.name,
    code: attr.code,
    short_name: attr.short_name?.toLowerCase(),
    shortName: attr.short_name?.toLowerCase(),
    sortOrder: attr.sort_order,
    color: MEETING_STATUS_COLOR_MAP[attr.short_name?.toLowerCase()] || '#6B7280',
  })).sort((a, b) => a.sortOrder - b.sortOrder);
};

// Process action status options from ACTION_TRACKER attribute group
const processActionStatusOptions = (attributes) => {
  const statusAttributes = attributes.filter(attr => 
    attr.code && attr.code.includes('ACTION_STATUS_') && attr.code !== 'ACTION_STATUS'
  );
  
  return statusAttributes.map(attr => {
    const shortName = attr.short_name?.toLowerCase() || attr.code?.replace('ACTION_STATUS_', '').toLowerCase();
    return {
      id: attr.id,
      value: shortName,
      label: attr.short_name?.charAt(0).toUpperCase() + attr.short_name?.slice(1).toLowerCase() || 
             attr.name?.replace('Action Status - ', '') || 
             attr.short_name ||
             attr.name,
      code: attr.code,
      short_name: shortName,
      shortName: shortName,
      sortOrder: attr.sort_order,
      color: ACTION_STATUS_COLOR_MAP[shortName] || '#6B7280',
      icon: ACTION_STATUS_ICONS[shortName] || 'Schedule',
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
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

// Normalize meeting status from API response
const normalizeMeetingStatus = (meeting) => {
  if (!meeting) return meeting;
  
  if (meeting.status) {
    let normalizedStatus = { ...meeting.status };
    
    if (normalizedStatus.short_name) {
      normalizedStatus.short_name = normalizedStatus.short_name.toLowerCase();
    }
    
    if (normalizedStatus.shortName && !normalizedStatus.short_name) {
      normalizedStatus.short_name = normalizedStatus.shortName.toLowerCase();
      delete normalizedStatus.shortName;
    }
    
    if (normalizedStatus.code && !normalizedStatus.short_name) {
      if (normalizedStatus.code.includes('_')) {
        const parts = normalizedStatus.code.split('_');
        normalizedStatus.short_name = parts[parts.length - 1].toLowerCase();
      }
    }
    
    if (typeof meeting.status === 'string') {
      let shortName = meeting.status;
      if (shortName.includes('_')) {
        const parts = shortName.split('_');
        shortName = parts[parts.length - 1];
      }
      normalizedStatus = {
        short_name: shortName.toLowerCase(),
        name: meeting.status,
        code: meeting.status
      };
    }
    
    return { ...meeting, status: normalizedStatus };
  }
  
  return meeting;
};

// ==================== Async Thunks ====================

// Fetch attributes from ACTION_TRACKER group (includes meeting statuses and action statuses)
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
      
      // Fetch from ACTION_TRACKER attribute group
      const response = await api.get('/attribute-groups/ACTION_TRACKER/attributes', {
        params: {
          active_only: true,
          sort_by: 'sort_order',
          sort_order: 'asc',
          limit: 100
        }
      });
      
      const allAttributes = response.data.items || response.data.data || response.data || [];
      
      return {
        fromCache: false,
        meetingStatusOptions: processMeetingStatusOptions(allAttributes),
        actionStatusOptions: processActionStatusOptions(allAttributes),
        priorityOptions: processPriorityOptions(allAttributes),
        timestamp: now,
      };
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Fetch meeting status options specifically
export const fetchMeetingStatusOptions = createAsyncThunk(
  'meetings/fetchMeetingStatusOptions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/attribute-groups/ACTION_TRACKER/attributes', {
        params: {
          active_only: true,
          search: 'MEETING_STATUS',
          sort_by: 'sort_order',
          sort_order: 'asc',
          limit: 20
        }
      });
      
      const attributes = response.data.items || [];
      
      const statusOptions = attributes
        .filter(attr => attr.code && attr.code.includes('MEETING_STATUS_') && attr.code !== 'MEETING_STATUS')
        .map(attr => ({
          id: attr.id,
          value: attr.short_name?.toLowerCase(),
          label: attr.short_name || attr.name?.replace('Meeting Status - ', ''),
          code: attr.code,
          short_name: attr.short_name?.toLowerCase(),
          sort_order: attr.sort_order,
          color: MEETING_STATUS_COLOR_MAP[attr.short_name?.toLowerCase()] || '#6B7280',
        }))
        .sort((a, b) => a.sort_order - b.sort_order);
      
      return statusOptions;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Fetch action status options specifically
export const fetchActionStatusOptions = createAsyncThunk(
  'meetings/fetchActionStatusOptions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/attribute-groups/ACTION_TRACKER/attributes', {
        params: {
          active_only: true,
          search: 'ACTION_STATUS',
          sort_by: 'sort_order',
          sort_order: 'asc',
          limit: 50
        }
      });
      
      const attributes = response.data.items || [];
      
      const statusOptions = attributes
        .filter(attr => attr.code && attr.code.includes('ACTION_STATUS_') && attr.code !== 'ACTION_STATUS')
        .map(attr => {
          const shortName = attr.short_name?.toLowerCase() || attr.code?.replace('ACTION_STATUS_', '').toLowerCase();
          return {
            id: attr.id,
            value: shortName,
            label: attr.short_name || attr.name?.replace('Action Status - ', ''),
            code: attr.code,
            short_name: shortName,
            sort_order: attr.sort_order,
            color: ACTION_STATUS_COLOR_MAP[shortName] || '#6B7280',
            icon: ACTION_STATUS_ICONS[shortName] || 'Schedule',
          };
        })
        .sort((a, b) => a.sort_order - b.sort_order);
      
      return statusOptions;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

export const createMeeting = createAsyncThunk(
  'meetings/createMeeting',
  async (meetingData, { rejectWithValue }) => {
    try {
      const response = await api.post('/action-tracker/meetings/', meetingData);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

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
      
      Object.keys(mergedParams).forEach(key => {
        if (mergedParams[key] == null || mergedParams[key] === '') {
          delete mergedParams[key];
        }
      });
      
      const response = await api.get('/action-tracker/meetings/', { params: mergedParams });
      
      const items = (response.data.items || response.data || []).map(normalizeMeetingStatus);
      
      return {
        items,
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

export const fetchMeetingById = createAsyncThunk(
  'meetings/fetchMeetingById',
  async (id, { rejectWithValue, getState }) => {
    try {
      if (!id) throw new Error('Meeting ID is required');
      const response = await api.get(`/action-tracker/meetings/${id}`);
      const meeting = normalizeMeetingStatus(response.data);
      
      const state = getState();
      const meetingStatusOptions = state.meetings.meetingStatusOptions;
      
      if (meeting.status && meetingStatusOptions && meetingStatusOptions.length > 0 && !meeting.status.short_name) {
        const matchedStatus = meetingStatusOptions.find(opt => 
          opt.code === meeting.status.code || 
          opt.name === meeting.status.name ||
          opt.value === meeting.status.code?.replace('MEETING_STATUS_', '').toLowerCase()
        );
        
        if (matchedStatus) {
          meeting.status.short_name = matchedStatus.value || matchedStatus.short_name;
        }
      }
      
      return meeting;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

export const updateMeeting = createAsyncThunk(
  'meetings/updateMeeting',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/action-tracker/meetings/${id}`, data);
      return normalizeMeetingStatus(response.data);
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

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

export const updateMeetingStatus = createAsyncThunk(
  'meetings/updateMeetingStatus',
  async ({ id, status, comment }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const meetingStatusOptions = state.meetings.meetingStatusOptions;
      
      let statusValue = status;
      
      if (meetingStatusOptions && meetingStatusOptions.length > 0) {
        const matchedStatus = meetingStatusOptions.find(opt => 
          opt.value === status || 
          opt.shortName === status || 
          opt.short_name === status
        );
        if (matchedStatus) {
          statusValue = matchedStatus.value || matchedStatus.short_name;
        }
      }
      
      console.log('Updating meeting status:', { id, status: statusValue, comment });
      
      const response = await api.patch(
        `/action-tracker/meetings/${id}/status`,
        null,
        { params: { status: statusValue.toLowerCase(), comment: comment || '' } }
      );
      
      const normalizedData = normalizeMeetingStatus(response.data);
      return normalizedData;
    } catch (error) {
      console.error('Update meeting status error:', error);
      return rejectWithValue(handleApiError(error));
    }
  }
);

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
    clearMinutesError: (state) => {
      state.ui.minutesError = null;
    },
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
    clearCurrentMeeting: (state) => {
      state.currentMeeting = null;
      state.ui.error = null;
    },
    clearMeetings: (state) => {
      state.meetings = { ...DEFAULT_PAGINATION };
      state.ui.error = null;
    },
    setMeetingPage: (state, action) => {
      state.meetings.page = action.payload;
    },
    setMeetingLimit: (state, action) => {
      state.meetings.limit = action.payload;
      state.meetings.page = 1;
    },
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
    clearCache: (state) => {
      state.cache.meetings.clear();
      state.cache.attributes = null;
      state.cache.timestamp = null;
    },
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
    setCurrentMeeting: (state, action) => {
      state.currentMeeting = normalizeMeetingStatus(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Action Tracker Attributes
      .addCase(fetchActionTrackerAttributes.pending, (state) => {
        if (!state.meetingStatusOptions.length && !state.actionStatusOptions.length) {
          state.ui.isLoading = true;
        }
      })
      .addCase(fetchActionTrackerAttributes.fulfilled, (state, action) => {
        state.ui.isLoading = false;
        if (!action.payload.fromCache) {
          state.meetingStatusOptions = action.payload.meetingStatusOptions;
          state.actionStatusOptions = action.payload.actionStatusOptions;
          state.priorityOptions = action.payload.priorityOptions;
          state.cache.timestamp = action.payload.timestamp;
        }
      })
      .addCase(fetchActionTrackerAttributes.rejected, (state, action) => {
        state.ui.isLoading = false;
        state.ui.error = action.payload;
      })
      
      // Fetch Meeting Status Options
      .addCase(fetchMeetingStatusOptions.fulfilled, (state, action) => {
        if (action.payload?.length) {
          state.meetingStatusOptions = action.payload;
        }
      })
      .addCase(fetchMeetingStatusOptions.rejected, (state, action) => {
        console.error('Failed to fetch meeting status options:', action.payload);
      })
      
      // Fetch Action Status Options
      .addCase(fetchActionStatusOptions.fulfilled, (state, action) => {
        if (action.payload?.length) {
          state.actionStatusOptions = action.payload;
        }
      })
      .addCase(fetchActionStatusOptions.rejected, (state, action) => {
        console.error('Failed to fetch action status options:', action.payload);
      })
      
      // Create Meeting
      .addCase(createMeeting.pending, (state) => {
        state.ui.isSubmitting = true;
        state.ui.success = false;
        state.ui.error = null;
      })
      .addCase(createMeeting.fulfilled, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.success = true;
        state.currentMeeting = normalizeMeetingStatus(action.payload);
        state.meetings.items = [normalizeMeetingStatus(action.payload), ...state.meetings.items];
        state.meetings.total += 1;
      })
      .addCase(createMeeting.rejected, (state, action) => {
        state.ui.isSubmitting = false;
        state.ui.success = false;
        state.ui.error = action.payload;
      })
      
      // Fetch Meetings
      .addCase(fetchMeetings.pending, (state) => {
        state.ui.isLoading = true;
        state.ui.error = null;
      })
      .addCase(fetchMeetings.fulfilled, (state, action) => {
        state.ui.isLoading = false;
        state.meetings = action.payload;
      })
      .addCase(fetchMeetings.rejected, (state, action) => {
        state.ui.isLoading = false;
        state.ui.error = action.payload;
      })
      
      // Fetch Meeting By ID
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
      
      // Update Meeting
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
      
      // Delete Meeting
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
      
      // Update Meeting Status
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
      
      // Meeting Minutes
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
      })
      .addCase(createMeetingMinutes.fulfilled, (state, action) => {
        state.currentMinutes.items = [action.payload, ...state.currentMinutes.items];
        state.currentMinutes.total += 1;
        state.ui.success = true;
      })
      .addCase(deleteMeetingMinutes.fulfilled, (state, action) => {
        state.currentMinutes.items = state.currentMinutes.items.filter(m => m.id !== action.payload);
        state.currentMinutes.total = Math.max(0, state.currentMinutes.total - 1);
      })
      .addCase(updateMeetingMinutes.fulfilled, (state, action) => {
        const index = state.currentMinutes.items.findIndex(m => m.id === action.payload.id);
        if (index !== -1) {
          state.currentMinutes.items[index] = action.payload;
        }
      })
      
      // Meeting Participants
      .addCase(fetchMeetingParticipants.fulfilled, (state, action) => {
        state.currentParticipants = action.payload;
      })
      
      // Meeting Actions
      .addCase(fetchMeetingActions.fulfilled, (state, action) => {
        state.currentActions = action.payload;
      });
  },
});

// ==================== Selectors ====================

// Base Selectors
export const selectMinutesLoading = (state) => state.meetings.ui.isLoading;

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

// Meeting Status Selectors
export const selectMeetingStatusOptions = (state) => state.meetings.meetingStatusOptions;
export const selectMeetingStatusOptionsLoading = (state) => state.meetings.ui.isLoading && !state.meetings.meetingStatusOptions.length;

// Action Status Selectors (for ActionDetail and MeetingActionsList)
export const selectActionStatusOptions = (state) => state.meetings.actionStatusOptions;
export const selectActionTrackerLoading = (state) => state.meetings.ui.isLoading && !state.meetings.actionStatusOptions.length;
export const selectActionTrackerError = (state) => state.meetings.ui.error;

// Alias for backward compatibility
export const selectStatusOptions = selectActionStatusOptions;

// Priority Selectors
export const selectPriorityOptions = (state) => state.meetings.priorityOptions;
export const selectMeetingPriorityOptions = (state) => state.meetings.priorityOptions;

// Filters Selectors
export const selectMeetingsFilters = (state) => state.meetings.filters;
export const selectMeetingPagination = (state) => ({
  total: state.meetings.meetings.total,
  pages: state.meetings.meetings.pages,
  page: state.meetings.meetings.page,
  limit: state.meetings.meetings.limit,
});

// Minutes Selectors
export const selectMeetingMinutes = (state) => state.meetings.currentMinutes.items;
export const selectMeetingMinutesTotal = (state) => state.meetings.currentMinutes.total;
export const selectMinutesError = (state) => state.meetings.ui.minutesError;

// Participants Selectors
export const selectMeetingParticipants = (state) => state.meetings.currentParticipants.items;

// Actions Selectors
export const selectMeetingActions = (state) => state.meetings.currentActions.items;

// Helper function to get status config by value
export const getActionStatusConfig = (state, statusValue) => {
  const status = state.meetings.actionStatusOptions.find(s => s.value === statusValue);
  if (status) {
    return {
      label: status.label,
      color: status.color,
      icon: status.icon,
    };
  }
  return {
    label: 'Pending',
    color: '#F59E0B',
    icon: 'Schedule',
  };
};

// Filtered Meetings Selector
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
          meeting.location_text?.toLowerCase().includes(searchLower)
      );
    }
    
    if (status) {
      filtered = filtered.filter((meeting) => 
        meeting.status?.short_name === status || 
        meeting.status === status
      );
    }
    
    if (priority) {
      filtered = filtered.filter((meeting) => meeting.priority === priority);
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

// Upcoming Meetings Selector
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

// Meetings Statistics Selector
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
        completionRate: 0,
      };
    }
    
    const stats = {
      total: items.length,
      scheduled: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
      byStatus: {},
      byMonth: {},
      completionRate: 0,
    };
    
    items.forEach((meeting) => {
      const meetingDate = new Date(meeting.meeting_date);
      const status = meeting.status?.short_name?.toLowerCase() || 'pending';
      
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      if (status === 'started') stats.ongoing++;
      else if (status === 'ended') stats.completed++;
      else if (status === 'cancelled') stats.cancelled++;
      else if (status === 'scheduled' || status === 'pending') stats.scheduled++;
      
      const monthKey = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
      stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
    });
    
    stats.completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    
    return stats;
  }
);

// ==================== Exports ====================
export const { 
  clearMeetingState,
  clearCurrentMeeting,
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
  setCurrentMeeting,
} = meetingSlice.actions;

export default meetingSlice.reducer;