// src/store/slices/actionTracker/participantSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

// ==================== Async Thunks ====================

// Participant CRUD
export const fetchParticipants = createAsyncThunk(
  'participants/fetchParticipants',
  async (params = {}) => {
    const response = await api.get('/action-tracker/participants/', { params });
    return response.data;
  }
);

export const fetchParticipantById = createAsyncThunk(
  'participants/fetchParticipantById',
  async (id) => {
    const response = await api.get(`/action-tracker/participants/${id}`);
    return response.data;
  }
);

export const createParticipant = createAsyncThunk(
  'participants/createParticipant',
  async (participantData) => {
    const response = await api.post('/action-tracker/participants', participantData);
    return response.data;
  }
);

export const updateParticipant = createAsyncThunk(
  'participants/updateParticipant',
  async ({ id, data }) => {
    const response = await api.put(`/action-tracker/participants/${id}`, data);
    return response.data;
  }
);

export const deleteParticipant = createAsyncThunk(
  'participants/deleteParticipant',
  async (id) => {
    await api.delete(`/action-tracker/participants/${id}`);
    return id;
  }
);

export const bulkCreateParticipants = createAsyncThunk(
  'participants/bulkCreateParticipants',
  async (participantsData) => {
    const response = await api.post('/action-tracker/participants/bulk', { participants: participantsData });
    return response.data;
  }
);

export const searchParticipants = createAsyncThunk(
  'participants/searchParticipants',
  async (query) => {
    const response = await api.get('/action-tracker/participants/search', { params: { q: query } });
    return response.data;
  }
);

// Participant List CRUD
export const fetchParticipantLists = createAsyncThunk(
  'participants/fetchParticipantLists',
  async (params = {}) => {
    const response = await api.get('/action-tracker/participant-lists/', { params });
    return response.data;
  }
);

export const fetchParticipantList = createAsyncThunk(
  'participants/fetchParticipantList',
  async (id) => {
    const response = await api.get(`/action-tracker/participant-lists/${id}`);
    return response.data;
  }
);

export const createParticipantList = createAsyncThunk(
  'participants/createParticipantList',
  async (listData) => {
    const response = await api.post('/action-tracker/participant-lists/', listData);
    return response.data;
  }
);

export const updateParticipantList = createAsyncThunk(
  'participants/updateParticipantList',
  async ({ id, data }) => {
    const response = await api.put(`/action-tracker/participant-lists/${id}`, data);
    return response.data;
  }
);

export const deleteParticipantList = createAsyncThunk(
  'participants/deleteParticipantList',
  async (id) => {
    await api.delete(`/action-tracker/participant-lists/${id}`);
    return id;
  }
);

// ==================== LIST MEMBERS MANAGEMENT ====================

export const fetchListMembers = createAsyncThunk(
  'participants/fetchListMembers',
  async ({ listId, params = {} }) => {
    const response = await api.get(`/action-tracker/participant-lists/${listId}/members`, { params });
    return { listId, data: response.data };
  }
);

export const addMembersToList = createAsyncThunk(
  'participants/addMembersToList',
  async ({ listId, participantIds }) => {
    const response = await api.post(`/action-tracker/participant-lists/${listId}/members`, {
      participant_ids: participantIds
    });
    return { listId, data: response.data };
  }
);

export const addSingleMemberToList = createAsyncThunk(
  'participants/addSingleMemberToList',
  async ({ listId, participantId }) => {
    const response = await api.post(`/action-tracker/participant-lists/${listId}/members`, {
      participant_ids: [participantId]
    });
    return { listId, data: response.data };
  }
);

export const removeMemberFromList = createAsyncThunk(
  'participants/removeMemberFromList',
  async ({ listId, participantId }) => {
    await api.delete(`/action-tracker/participant-lists/${listId}/members/${participantId}`);
    return { listId, participantId };
  }
);

export const fetchAvailableParticipants = createAsyncThunk(
  'participants/fetchAvailableParticipants',
  async ({ listId, params = {} }) => {
    const response = await api.get(`/action-tracker/participant-lists/${listId}/available-participants`, { params });
    return { listId, data: response.data };
  }
);

export const bulkAddMembersToList = createAsyncThunk(
  'participants/bulkAddMembersToList',
  async ({ listId, participantIds }) => {
    const response = await api.post(`/action-tracker/participant-lists/${listId}/members/bulk`, {
      participant_ids: participantIds
    });
    return { listId, data: response.data };
  }
);

// ==================== Participant List Statistics ====================

export const fetchListStatistics = createAsyncThunk(
  'participants/fetchListStatistics',
  async (listId) => {
    const response = await api.get(`/action-tracker/participant-lists/${listId}/statistics`);
    return { listId, data: response.data };
  }
);

export const fetchAllListsStatistics = createAsyncThunk(
  'participants/fetchAllListsStatistics',
  async () => {
    const response = await api.get('/action-tracker/participant-lists/statistics');
    return response.data;
  }
);

// ==================== Export/Import ====================

export const exportParticipantList = createAsyncThunk(
  'participants/exportParticipantList',
  async ({ listId, format = 'csv' }) => {
    const response = await api.get(`/action-tracker/participant-lists/${listId}/export`, {
      params: { format },
      responseType: 'blob'
    });
    return { listId, data: response.data, format };
  }
);

export const importParticipants = createAsyncThunk(
  'participants/importParticipants',
  async (formData) => {
    const response = await api.post('/action-tracker/participants/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
);

// ==================== MEETING PARTICIPANTS (Async Thunks) ====================

export const fetchMeetingParticipants = createAsyncThunk(
  'participants/fetchMeetingParticipants',
  async (meetingId) => {
    const response = await api.get(`/action-tracker/meetings/${meetingId}/participants`);
    return response.data;
  }
);

export const addParticipantToMeeting = createAsyncThunk(
  'participants/addParticipantToMeeting',
  async ({ meetingId, participantData }) => {
    const response = await api.post(`/action-tracker/meetings/${meetingId}/participants`, participantData);
    return response.data;
  }
);

export const removeMeetingParticipant = createAsyncThunk(
  'participants/removeMeetingParticipant',
  async ({ meetingId, participantId }) => {
    await api.delete(`/action-tracker/meetings/${meetingId}/participants/${participantId}`);
    return { meetingId, participantId };
  }
);

// ==================== Slice ====================

const participantSlice = createSlice({
  name: 'participants',
  initialState: {
    // Participants
    participants: {
      items: [],
      total: 0,
      pages: 1,
      page: 1,
      limit: 20
    },
    currentParticipant: null,
    // Participant Lists
    lists: [],
    currentList: null,
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
    // UI State
    loading: false,
    error: null,
    exportLoading: false,
    importLoading: false,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
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
      state.lists = [];
      state.listMembers = {};
      state.availableParticipants = {};
      state.listStatistics = {};
    },
    setPage: (state, action) => {
      state.participants.page = action.payload;
    },
    setParticipantsLimit: (state, action) => {
      state.participants.limit = action.payload;
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
      const selectedList = state.lists.find(l => l.id === listId);
      
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
      
      // Remove from fromLists
      state.meetingParticipants.fromLists = state.meetingParticipants.fromLists.filter(
        p => p.id !== participantId
      );
      
      // Remove from custom
      state.meetingParticipants.custom = state.meetingParticipants.custom.filter(
        p => p.id !== participantId
      );
      
      // Update combined list
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
    
    // Batch add multiple custom participants
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
    
    // Update participant attendance for meeting
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
    
    // Reset all meeting participant state (for new meeting)
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
      // ========== Fetch Participants ==========
      .addCase(fetchParticipants.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchParticipants.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload && typeof action.payload === 'object') {
          state.participants = {
            items: action.payload.items || action.payload || [],
            total: action.payload.total || (Array.isArray(action.payload) ? action.payload.length : 0),
            pages: action.payload.pages || 1,
            page: action.payload.page || 1,
            limit: action.payload.limit || 20
          };
        }
      })
      .addCase(fetchParticipants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      
      // ========== Fetch Participant By ID ==========
      .addCase(fetchParticipantById.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchParticipantById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentParticipant = action.payload;
      })
      .addCase(fetchParticipantById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      
      // ========== Create Participant ==========
      .addCase(createParticipant.pending, (state) => {
        state.loading = true;
      })
      .addCase(createParticipant.fulfilled, (state, action) => {
        state.loading = false;
        state.participants.items.unshift(action.payload);
        state.participants.total += 1;
      })
      .addCase(createParticipant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      
      // ========== Update Participant ==========
      .addCase(updateParticipant.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateParticipant.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.participants.items.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.participants.items[index] = action.payload;
        }
        if (state.currentParticipant?.id === action.payload.id) {
          state.currentParticipant = action.payload;
        }
      })
      .addCase(updateParticipant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
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
      .addCase(bulkCreateParticipants.pending, (state) => {
        state.loading = true;
      })
      .addCase(bulkCreateParticipants.fulfilled, (state, action) => {
        state.loading = false;
        if (Array.isArray(action.payload)) {
          state.participants.items.unshift(...action.payload);
          state.participants.total += action.payload.length;
        }
      })
      .addCase(bulkCreateParticipants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      
      // ========== Search Participants ==========
      .addCase(searchParticipants.fulfilled, (state, action) => {
        state.searchResults = action.payload.items || action.payload || [];
      })
      
      // ========== Fetch Lists ==========
      .addCase(fetchParticipantLists.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchParticipantLists.fulfilled, (state, action) => {
        state.loading = false;
        state.lists = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchParticipantLists.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      
      // ========== Fetch Single List ==========
      .addCase(fetchParticipantList.fulfilled, (state, action) => {
        state.currentList = action.payload;
      })
      
      // ========== Create List ==========
      .addCase(createParticipantList.fulfilled, (state, action) => {
        state.lists.unshift(action.payload);
      })
      
      // ========== Update List ==========
      .addCase(updateParticipantList.fulfilled, (state, action) => {
        const index = state.lists.findIndex(l => l.id === action.payload.id);
        if (index !== -1) {
          state.lists[index] = action.payload;
        }
        if (state.currentList?.id === action.payload.id) {
          state.currentList = action.payload;
        }
      })
      
      // ========== Delete List ==========
      .addCase(deleteParticipantList.fulfilled, (state, action) => {
        state.lists = state.lists.filter(l => l.id !== action.payload);
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
        state.error = action.error.message;
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
        state.error = action.error.message;
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
export const selectAllParticipants = (state) => state.participants.participants.items;
export const selectParticipantLists = (state) => state.participants.lists;
export const selectMeetingParticipants = (state) => state.participants.meetingParticipants;
export const selectMeetingParticipantsAll = (state) => state.participants.meetingParticipants.all;
export const selectMeetingParticipantsCount = (state) => state.participants.meetingParticipants.all.length;
export const selectMeetingChairperson = (state) => 
  state.participants.meetingParticipants.all.find(p => p.is_chairperson);
export const selectParticipantsLoading = (state) => state.participants.loading;
export const selectParticipantsError = (state) => state.participants.error;

// ==================== Exports ====================
export const { 
  clearError, 
  clearCurrentList, 
  clearCurrentParticipant,
  clearListMembers,
  clearSearchResults,
  clearAllListsData,
  setPage,
  setParticipantsLimit,
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