import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import menuReducer from './slices/menuSlice';
import {
  meetingReducer,
  participantReducer,
  actionReducer,
  dashboardReducer,
} from './slices/actionTracker';
import adminReducer from './slices/adminSlice';
import roleReducer from './slices/roleSlice';
import profileReducer from './slices/profileSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    menu: menuReducer,
    meetings: meetingReducer,
    participants: participantReducer,
    actions: actionReducer,
    admin: adminReducer,        // Only once
    profile: profileReducer,
    roles: roleReducer,
    dashboard: dashboardReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;