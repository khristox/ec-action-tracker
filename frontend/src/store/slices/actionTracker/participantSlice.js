// src/store/slices/actionTracker/participantSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// ==================== Helper Functions ====================

const extractData = (response) => {
  if (response.data?.data) return response.data.data;
  if (response.data?.items) return response.data.items;
  return response.data || [];
};

const extractPagination = (response) => ({
  items: extractData(response),
  total: response.data?.total || 0,
  page: response.data?.page || 1,
  limit: response.data?.limit || 20,
  pages: response.data?.pages || 1
});

// ==================== Async Thunks - Users ====================

export const fetchUsers = createAsyncThunk(
  'participants/fetchUsers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/available', { 
        params: { 
          limit: 100,
          is_active: true,
          ...params 
        } 
      });
      return extractData(response);
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch users');
    }
  }
);

export const fetchUserById = createAsyncThunk(
  'participants/fetchUserById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch user');
    }
  }
);

export const searchUsers = createAsyncThunk(
  'participants/searchUsers',
  async (query, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/search', { params: { q: query } });
      return extractData(response);
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to search users');
    }
  }
);

// ==================== Async Thunks - Participants ====================

export const fetchParticipants = createAsyncThunk(
  'participants/fetchParticipants',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/participants/', { params });
      return extractPagination(response);
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch participants');
    }
  }
);

export const fetchParticipantById = createAsyncThunk(
  'participants/fetchParticipantById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/participants/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch participant');
    }
  }
);

export const createParticipant = createAsyncThunk(
  'participants/createParticipant',
  async (participantData, { rejectWithValue }) => {
    try {
      const { _listId, ...data } = participantData;
      let url = '/action-tracker/participants/';
      if (_listId) {
        url += `?participant_list_id=${_listId}`;
      }
      const response = await api.post(url, data);
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create participant');
    }
  }
);

export const updateParticipant = createAsyncThunk(
  'participants/updateParticipant',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/action-tracker/participants/${id}`, data);
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update participant');
    }
  }
);

export const deleteParticipant = createAsyncThunk(
  'participants/deleteParticipant',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/action-tracker/participants/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete participant');
    }
  }
);

export const bulkCreateParticipants = createAsyncThunk(
  'participants/bulkCreateParticipants',
  async (participantsData, { rejectWithValue }) => {
    try {
      const response = await api.post('/action-tracker/participants/bulk', { participants: participantsData });
      return extractData(response);
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to bulk create participants');
    }
  }
);

export const searchParticipants = createAsyncThunk(
  'participants/searchParticipants',
  async (query, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/participants/search', { params: { q: query } });
      return extractData(response);
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to search participants');
    }
  }
);

// ==================== Async Thunks - Participant Lists ====================

export const fetchParticipantLists = createAsyncThunk(
  'participants/fetchParticipantLists',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/participant-lists/', { params });
      return {
        items: extractData(response),
        total: response.data?.total || 0,
        page: response.data?.page || 1,
        limit: response.data?.limit || 20,
        pages: response.data?.pages || 1
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch participant lists');
    }
  }
);

export const fetchParticipantList = createAsyncThunk(
  'participants/fetchParticipantList',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/participant-lists/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch participant list');
    }
  }
);

export const createParticipantList = createAsyncThunk(
  'participants/createParticipantList',
  async (listData, { rejectWithValue }) => {
    try {
      const response = await api.post('/action-tracker/participant-lists/', listData);
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create participant list');
    }
  }
);

export const updateParticipantList = createAsyncThunk(
  'participants/updateParticipantList',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/action-tracker/participant-lists/${id}`, data);
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update participant list');
    }
  }
);

export const deleteParticipantList = createAsyncThunk(
  'participants/deleteParticipantList',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/action-tracker/participant-lists/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete participant list');
    }
  }
);

// ==================== List Members Management ====================

export const fetchListMembers = createAsyncThunk(
  'participants/fetchListMembers',
  async ({ listId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/participant-lists/${listId}/members`, { params });
      return { listId, data: extractPagination(response) };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch list members');
    }
  }
);

export const addMembersToList = createAsyncThunk(
  'participants/addMembersToList',
  async ({ listId, participantIds }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/participant-lists/${listId}/members`, {
        participant_ids: participantIds
      });
      return { listId, data: extractData(response) };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to add members to list');
    }
  }
);

export const addSingleMemberToList = createAsyncThunk(
  'participants/addSingleMemberToList',
  async ({ listId, participantId }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/participant-lists/${listId}/members`, {
        participant_ids: [participantId]
      });
      return { listId, data: extractData(response) };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to add member to list');
    }
  }
);

export const removeMemberFromList = createAsyncThunk(
  'participants/removeMemberFromList',
  async ({ listId, participantId }, { rejectWithValue }) => {
    try {
      await api.delete(`/action-tracker/participant-lists/${listId}/members/${participantId}`);
      return { listId, participantId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to remove member from list');
    }
  }
);

export const fetchAvailableParticipants = createAsyncThunk(
  'participants/fetchAvailableParticipants',
  async ({ listId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/participant-lists/${listId}/available-participants`, { params });
      return { listId, data: extractPagination(response) };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch available participants');
    }
  }
);

export const bulkAddMembersToList = createAsyncThunk(
  'participants/bulkAddMembersToList',
  async ({ listId, participantIds }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/participant-lists/${listId}/members/bulk`, {
        participant_ids: participantIds
      });
      return { listId, data: extractData(response) };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to bulk add members');
    }
  }
);

// ==================== Participant List Statistics ====================

export const fetchListStatistics = createAsyncThunk(
  'participants/fetchListStatistics',
  async (listId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/participant-lists/${listId}/statistics`);
      return { listId, data: response.data?.data || response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch list statistics');
    }
  }
);

export const fetchAllListsStatistics = createAsyncThunk(
  'participants/fetchAllListsStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/action-tracker/participant-lists/statistics');
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch statistics');
    }
  }
);

// ==================== Export/Import ====================

export const exportParticipantList = createAsyncThunk(
  'participants/exportParticipantList',
  async ({ listId, format = 'csv' }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/participant-lists/${listId}/export`, {
        params: { format },
        responseType: 'blob'
      });
      return { listId, data: response.data, format };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to export list');
    }
  }
);

export const importParticipants = createAsyncThunk(
  'participants/importParticipants',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await api.post('/action-tracker/participants/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to import participants');
    }
  }
);

// ==================== Meeting Participants ====================

export const fetchMeetingParticipants = createAsyncThunk(
  'participants/fetchMeetingParticipants',
  async (meetingId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/participants/`);
      return extractData(response);
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch meeting participants');
    }
  }
);

export const addParticipantToMeeting = createAsyncThunk(
  'participants/addParticipantToMeeting',
  async ({ meetingId, participantData }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/action-tracker/meetings/${meetingId}/participants/`, participantData);
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to add participant to meeting');
    }
  }
);

export const removeMeetingParticipant = createAsyncThunk(
  'participants/removeMeetingParticipant',
  async ({ meetingId, participantId }, { rejectWithValue }) => {
    try {
      await api.delete(`/action-tracker/meetings/${meetingId}/participants/${participantId}`);
      return { meetingId, participantId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to remove meeting participant');
    }
  }
);

// ==================== Initial State ====================

const initialState = {
  // Users
  users: {
    items: [],
    loading: false,
    error: null,
    total: 0
  },
  // Participants
  participants: {
    items: [],
    total: 0,
    pages: 1,
    page: 1,
    limit: 20,
    loading: false,
    error: null
  },
  currentParticipant: null,
  participantLoading: false,
  
  // Participant Lists
  lists: {
    items: [],
    total: 0,
    pages: 1,
    page: 1,
    limit: 20,
    loading: false,
    error: null
  },
  currentList: null,
  listLoading: false,
  
  // List Members
  listMembers: {},
  availableParticipants: {},
  
  // Meeting Participants (for create meeting flow)
  meetingParticipants: {
    custom: [],      // Custom participants added during meeting creation
    fromLists: [],   // Participants added from lists
    all: []          // Combined list
  },
  selectedListForMeeting: null,
  
  // Statistics
  listStatistics: {},
  allListsStatistics: null,
  
  // Search
  searchResults: [],
  
  // Export/Import
  exportLoading: false,
  importLoading: false,
  
  // UI State
  error: null
};

// ==================== Slice ====================

const participantSlice = createSlice({
  name: 'participants',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.users.error = null;
      state.participants.error = null;
      state.lists.error = null;
    },
    clearCurrentList: (state) => {
      state.currentList = null;
    },
    clearCurrentParticipant: (state) => {
      state.currentParticipant = null;
    },
    clearListMembers: (state, action) => {
      const { listId } = action.payload;
      delete state.listMembers[listId];
      delete state.availableParticipants[listId];
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    clearAllListsData: (state) => {
      state.lists.items = [];
      state.listMembers = {};
      state.availableParticipants = {};
      state.listStatistics = {};
    },
    setParticipantsPage: (state, action) => {
      state.participants.page = action.payload;
    },
    setParticipantsLimit: (state, action) => {
      state.participants.limit = action.payload;
    },
    setListsPage: (state, action) => {
      state.lists.page = action.payload;
    },
    setListsLimit: (state, action) => {
      state.lists.limit = action.payload;
    },
    
    // ==================== MEETING PARTICIPANT REDUCERS ====================
    addCustomParticipant: (state, action) => {
      const newParticipant = {
        id: `temp_${Date.now()}_${Math.random()}`,
        ...action.payload,
        is_custom: true,
        added_at: new Date().toISOString()
      };
      state.meetingParticipants.custom.push(newParticipant);
      state.meetingParticipants.all = [
        ...state.meetingParticipants.fromLists,
        ...state.meetingParticipants.custom
      ];
    },
    
    removeCustomParticipant: (state, action) => {
      const index = action.payload;
      state.meetingParticipants.custom = state.meetingParticipants.custom.filter((_, i) => i !== index);
      state.meetingParticipants.all = [
        ...state.meetingParticipants.fromLists,
        ...state.meetingParticipants.custom
      ];
    },
    
    updateCustomParticipant: (state, action) => {
      const { index, data } = action.payload;
      if (state.meetingParticipants.custom[index]) {
        state.meetingParticipants.custom[index] = {
          ...state.meetingParticipants.custom[index],
          ...data
        };
        state.meetingParticipants.all = [
          ...state.meetingParticipants.fromLists,
          ...state.meetingParticipants.custom
        ];
      }
    },
    
    setMeetingChairperson: (state, action) => {
      const participantId = action.payload;
      
      // Update in custom participants
      state.meetingParticipants.custom = state.meetingParticipants.custom.map(p => ({
        ...p,
        is_chairperson: p.id === participantId
      }));
      
      // Update in fromLists participants
      state.meetingParticipants.fromLists = state.meetingParticipants.fromLists.map(p => ({
        ...p,
        is_chairperson: p.id === participantId
      }));
      
      // Update combined list
      state.meetingParticipants.all = state.meetingParticipants.all.map(p => ({
        ...p,
        is_chairperson: p.id === participantId
      }));
    },
    
    addParticipantsFromListToMeeting: (state, action) => {
      const { listId, participants } = action.payload;
      const selectedList = state.lists.items.find(l => l.id === listId);
      
      if (selectedList && participants) {
        const newParticipants = participants.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          telephone: p.telephone,
          title: p.title,
          organization: p.organization,
          is_chairperson: false,
          from_list: true,
          list_id: listId,
          list_name: selectedList.name
        }));
        
        state.meetingParticipants.fromLists = [
          ...state.meetingParticipants.fromLists,
          ...newParticipants
        ];
        state.meetingParticipants.all = [
          ...state.meetingParticipants.fromLists,
          ...state.meetingParticipants.custom
        ];
      }
    },
    
    removeLocalMeetingParticipant: (state, action) => {
      const participantId = action.payload;
      
      state.meetingParticipants.fromLists = state.meetingParticipants.fromLists.filter(
        p => p.id !== participantId
      );
      
      state.meetingParticipants.custom = state.meetingParticipants.custom.filter(
        p => p.id !== participantId
      );
      
      state.meetingParticipants.all = [
        ...state.meetingParticipants.fromLists,
        ...state.meetingParticipants.custom
      ];
    },
    
    clearMeetingParticipants: (state) => {
      state.meetingParticipants = {
        custom: [],
        fromLists: [],
        all: []
      };
      state.selectedListForMeeting = null;
    },
    
    setSelectedListForMeeting: (state, action) => {
      state.selectedListForMeeting = action.payload;
    },
    
    addMultipleCustomParticipants: (state, action) => {
      const newParticipants = action.payload.map((p, index) => ({
        id: `temp_${Date.now()}_${index}_${Math.random()}`,
        ...p,
        is_custom: true,
        added_at: new Date().toISOString()
      }));
      state.meetingParticipants.custom.push(...newParticipants);
      state.meetingParticipants.all = [
        ...state.meetingParticipants.fromLists,
        ...state.meetingParticipants.custom
      ];
    },
    
    updateParticipantAttendance: (state, action) => {
      const { participantId, attendanceStatus } = action.payload;
      const updateAttendance = (participant) => {
        if (participant.id === participantId) {
          return { ...participant, attendance_status: attendanceStatus };
        }
        return participant;
      };
      
      state.meetingParticipants.fromLists = state.meetingParticipants.fromLists.map(updateAttendance);
      state.meetingParticipants.custom = state.meetingParticipants.custom.map(updateAttendance);
      state.meetingParticipants.all = state.meetingParticipants.all.map(updateAttendance);
    },
    
    resetMeetingParticipants: (state) => {
      state.meetingParticipants = {
        custom: [],
        fromLists: [],
        all: []
      };
      state.selectedListForMeeting = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // ========== Fetch Users ==========
      .addCase(fetchUsers.pending, (state) => {
        state.users.loading = true;
        state.users.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.users.loading = false;
        state.users.items = action.payload;
        state.users.total = action.payload.length;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.users.loading = false;
        state.users.error = action.payload;
      })
      
      // ========== Search Users ==========
      .addCase(searchUsers.pending, (state) => {
        state.users.loading = true;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.users.loading = false;
        state.users.items = action.payload;
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.users.loading = false;
        state.users.error = action.payload;
      })
      
      // ========== Fetch Participants ==========
      .addCase(fetchParticipants.pending, (state) => {
        state.participants.loading = true;
        state.participants.error = null;
      })
      .addCase(fetchParticipants.fulfilled, (state, action) => {
        state.participants.loading = false;
        state.participants.items = action.payload.items;
        state.participants.total = action.payload.total;
        state.participants.page = action.payload.page;
        state.participants.limit = action.payload.limit;
        state.participants.pages = action.payload.pages;
      })
      .addCase(fetchParticipants.rejected, (state, action) => {
        state.participants.loading = false;
        state.participants.error = action.payload;
      })
      
      // ========== Fetch Participant By ID ==========
      .addCase(fetchParticipantById.pending, (state) => {
        state.participantLoading = true;
      })
      .addCase(fetchParticipantById.fulfilled, (state, action) => {
        state.participantLoading = false;
        state.currentParticipant = action.payload;
      })
      .addCase(fetchParticipantById.rejected, (state, action) => {
        state.participantLoading = false;
        state.error = action.payload;
      })
      
      // ========== Create Participant ==========
      .addCase(createParticipant.fulfilled, (state, action) => {
        state.participants.items.unshift(action.payload);
        state.participants.total += 1;
      })
      
      // ========== Update Participant ==========
      .addCase(updateParticipant.fulfilled, (state, action) => {
        const index = state.participants.items.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.participants.items[index] = action.payload;
        }
        if (state.currentParticipant?.id === action.payload.id) {
          state.currentParticipant = action.payload;
        }
      })
      
      // ========== Delete Participant ==========
      .addCase(deleteParticipant.fulfilled, (state, action) => {
        state.participants.items = state.participants.items.filter(p => p.id !== action.payload);
        state.participants.total = Math.max(0, state.participants.total - 1);
        if (state.currentParticipant?.id === action.payload) {
          state.currentParticipant = null;
        }
      })
      
      // ========== Bulk Create Participants ==========
      .addCase(bulkCreateParticipants.fulfilled, (state, action) => {
        if (Array.isArray(action.payload)) {
          state.participants.items.unshift(...action.payload);
          state.participants.total += action.payload.length;
        }
      })
      
      // ========== Search Participants ==========
      .addCase(searchParticipants.fulfilled, (state, action) => {
        state.searchResults = action.payload;
      })
      
      // ========== Fetch Participant Lists ==========
      .addCase(fetchParticipantLists.pending, (state) => {
        state.lists.loading = true;
        state.lists.error = null;
      })
      .addCase(fetchParticipantLists.fulfilled, (state, action) => {
        state.lists.loading = false;
        state.lists.items = action.payload.items;
        state.lists.total = action.payload.total;
        state.lists.page = action.payload.page;
        state.lists.limit = action.payload.limit;
        state.lists.pages = action.payload.pages;
      })
      .addCase(fetchParticipantLists.rejected, (state, action) => {
        state.lists.loading = false;
        state.lists.error = action.payload;
      })
      
      // ========== Fetch Single List ==========
      .addCase(fetchParticipantList.pending, (state) => {
        state.listLoading = true;
      })
      .addCase(fetchParticipantList.fulfilled, (state, action) => {
        state.listLoading = false;
        state.currentList = action.payload;
      })
      .addCase(fetchParticipantList.rejected, (state, action) => {
        state.listLoading = false;
        state.error = action.payload;
      })
      
      // ========== Create List ==========
      .addCase(createParticipantList.fulfilled, (state, action) => {
        state.lists.items.unshift(action.payload);
        state.lists.total += 1;
      })
      
      // ========== Update List ==========
      .addCase(updateParticipantList.fulfilled, (state, action) => {
        const index = state.lists.items.findIndex(l => l.id === action.payload.id);
        if (index !== -1) {
          state.lists.items[index] = action.payload;
        }
        if (state.currentList?.id === action.payload.id) {
          state.currentList = action.payload;
        }
      })
      
      // ========== Delete List ==========
      .addCase(deleteParticipantList.fulfilled, (state, action) => {
        state.lists.items = state.lists.items.filter(l => l.id !== action.payload);
        state.lists.total = Math.max(0, state.lists.total - 1);
        if (state.currentList?.id === action.payload) {
          state.currentList = null;
        }
        delete state.listMembers[action.payload];
        delete state.availableParticipants[action.payload];
        delete state.listStatistics[action.payload];
      })
      
      // ========== Fetch List Members ==========
      .addCase(fetchListMembers.fulfilled, (state, action) => {
        state.listMembers[action.payload.listId] = action.payload.data;
      })
      
      // ========== Add Members ==========
      .addCase(addMembersToList.fulfilled, (state, action) => {
        delete state.listMembers[action.payload.listId];
        delete state.availableParticipants[action.payload.listId];
      })
      
      .addCase(addSingleMemberToList.fulfilled, (state, action) => {
        delete state.listMembers[action.payload.listId];
        delete state.availableParticipants[action.payload.listId];
      })
      
      // ========== Remove Member ==========
      .addCase(removeMemberFromList.fulfilled, (state, action) => {
        if (state.listMembers[action.payload.listId]) {
          const members = state.listMembers[action.payload.listId];
          members.items = members.items.filter(p => p.id !== action.payload.participantId);
          members.total -= 1;
        }
      })
      
      // ========== Fetch Available Participants ==========
      .addCase(fetchAvailableParticipants.fulfilled, (state, action) => {
        state.availableParticipants[action.payload.listId] = action.payload.data;
      })
      
      // ========== Bulk Add Members ==========
      .addCase(bulkAddMembersToList.fulfilled, (state, action) => {
        delete state.listMembers[action.payload.listId];
        delete state.availableParticipants[action.payload.listId];
      })
      
      // ========== Fetch List Statistics ==========
      .addCase(fetchListStatistics.fulfilled, (state, action) => {
        state.listStatistics[action.payload.listId] = action.payload.data;
      })
      
      .addCase(fetchAllListsStatistics.fulfilled, (state, action) => {
        state.allListsStatistics = action.payload;
      })
      
      // ========== Export Participant List ==========
      .addCase(exportParticipantList.pending, (state) => {
        state.exportLoading = true;
      })
      .addCase(exportParticipantList.fulfilled, (state) => {
        state.exportLoading = false;
      })
      .addCase(exportParticipantList.rejected, (state, action) => {
        state.exportLoading = false;
        state.error = action.payload;
      })
      
      // ========== Import Participants ==========
      .addCase(importParticipants.pending, (state) => {
        state.importLoading = true;
      })
      .addCase(importParticipants.fulfilled, (state) => {
        state.importLoading = false;
      })
      .addCase(importParticipants.rejected, (state, action) => {
        state.importLoading = false;
        state.error = action.payload;
      })
      
      // ========== Meeting Participants ==========
      .addCase(fetchMeetingParticipants.fulfilled, (state, action) => {
        state.meetingParticipants.all = action.payload;
        state.meetingParticipants.fromLists = action.payload.filter(p => !p.is_custom);
        state.meetingParticipants.custom = action.payload.filter(p => p.is_custom);
      })
      
      .addCase(removeMeetingParticipant.fulfilled, (state, action) => {
        const { participantId } = action.payload;
        state.meetingParticipants.fromLists = state.meetingParticipants.fromLists.filter(
          p => p.id !== participantId
        );
        state.meetingParticipants.custom = state.meetingParticipants.custom.filter(
          p => p.id !== participantId
        );
        state.meetingParticipants.all = [
          ...state.meetingParticipants.fromLists,
          ...state.meetingParticipants.custom
        ];
      });
  },
});

// ==================== Selectors ====================
export const selectUsers = (state) => state.participants.users.items;
export const selectUsersLoading = (state) => state.participants.users.loading;
export const selectUsersError = (state) => state.participants.users.error;

export const selectAllParticipants = (state) => state.participants.participants.items;
export const selectParticipantsPagination = (state) => ({
  total: state.participants.participants.total,
  page: state.participants.participants.page,
  limit: state.participants.participants.limit,
  pages: state.participants.participants.pages
});
export const selectParticipantsLoading = (state) => state.participants.participants.loading;
export const selectParticipantsError = (state) => state.participants.participants.error;

export const selectParticipantLists = (state) => state.participants.lists.items;
export const selectListsPagination = (state) => ({
  total: state.participants.lists.total,
  page: state.participants.lists.page,
  limit: state.participants.lists.limit,
  pages: state.participants.lists.pages
});
export const selectListsLoading = (state) => state.participants.lists.loading;
export const selectListsError = (state) => state.participants.lists.error;

export const selectCurrentList = (state) => state.participants.currentList;
export const selectCurrentParticipant = (state) => state.participants.currentParticipant;

export const selectListMembers = (state, listId) => state.participants.listMembers[listId];
export const selectAvailableParticipants = (state, listId) => state.participants.availableParticipants[listId];
export const selectListStatistics = (state, listId) => state.participants.listStatistics[listId];
export const selectAllListsStatistics = (state) => state.participants.allListsStatistics;

export const selectMeetingParticipants = (state) => state.participants.meetingParticipants;
export const selectMeetingParticipantsAll = (state) => state.participants.meetingParticipants.all;
export const selectMeetingParticipantsCount = (state) => state.participants.meetingParticipants.all.length;
export const selectMeetingChairperson = (state) => 
  state.participants.meetingParticipants.all.find(p => p.is_chairperson);
export const selectSelectedListForMeeting = (state) => state.participants.selectedListForMeeting;

export const selectSearchResults = (state) => state.participants.searchResults;
export const selectExportLoading = (state) => state.participants.exportLoading;
export const selectImportLoading = (state) => state.participants.importLoading;
export const selectGlobalError = (state) => state.participants.error;

// ==================== Exports ====================
export const { 
  clearError, 
  clearCurrentList, 
  clearCurrentParticipant,
  clearListMembers,
  clearSearchResults,
  clearAllListsData,
  setParticipantsPage,
  setParticipantsLimit,
  setListsPage,
  setListsLimit,
  // Meeting participant actions
  addCustomParticipant,
  removeCustomParticipant,
  updateCustomParticipant,
  setMeetingChairperson,
  addParticipantsFromListToMeeting,
  removeLocalMeetingParticipant,
  clearMeetingParticipants,
  setSelectedListForMeeting,
  addMultipleCustomParticipants,
  updateParticipantAttendance,
  resetMeetingParticipants
} = participantSlice.actions;

export default participantSlice.reducer;