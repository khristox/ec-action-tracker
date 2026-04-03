import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../../services/api';

export const fetchParticipants = createAsyncThunk(
  'participants/fetchParticipants',
  async (params = {}) => {
    const response = await api.get('/action-tracker/participants', { params });
    return response.data;
  }
);

export const fetchMyParticipants = createAsyncThunk(
  'participants/fetchMyParticipants',
  async () => {
    const response = await api.get('/action-tracker/participants/my');
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

export const fetchParticipantLists = createAsyncThunk(
  'participants/fetchParticipantLists',
  async () => {
    const response = await api.get('/action-tracker/participant-lists');
    return response.data;
  }
);

export const createParticipantList = createAsyncThunk(
  'participants/createParticipantList',
  async (listData) => {
    const response = await api.post('/action-tracker/participant-lists', listData);
    return response.data;
  }
);

const participantSlice = createSlice({
  name: 'participants',
  initialState: {
    participants: [],
    myParticipants: [],
    participantLists: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Participants
      .addCase(fetchParticipants.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchParticipants.fulfilled, (state, action) => {
        state.loading = false;
        state.participants = action.payload;
      })
      .addCase(fetchParticipants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch My Participants
      .addCase(fetchMyParticipants.fulfilled, (state, action) => {
        state.myParticipants = action.payload;
      })
      // Create Participant
      .addCase(createParticipant.fulfilled, (state, action) => {
        state.participants.unshift(action.payload);
        state.myParticipants.unshift(action.payload);
      })
      // Update Participant
      .addCase(updateParticipant.fulfilled, (state, action) => {
        const index = state.participants.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.participants[index] = action.payload;
        }
        const myIndex = state.myParticipants.findIndex(p => p.id === action.payload.id);
        if (myIndex !== -1) {
          state.myParticipants[myIndex] = action.payload;
        }
      })
      // Delete Participant
      .addCase(deleteParticipant.fulfilled, (state, action) => {
        state.participants = state.participants.filter(p => p.id !== action.payload);
        state.myParticipants = state.myParticipants.filter(p => p.id !== action.payload);
      })
      // Fetch Participant Lists
      .addCase(fetchParticipantLists.fulfilled, (state, action) => {
        state.participantLists = action.payload;
      })
      // Create Participant List
      .addCase(createParticipantList.fulfilled, (state, action) => {
        state.participantLists.unshift(action.payload);
      });
  },
});

export const { clearError } = participantSlice.actions;
export default participantSlice.reducer;