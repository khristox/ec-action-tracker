import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import menuReducer from './slices/menuSlice';
import {
  meetingReducer,
  participantReducer,
  actionReducer,
  dashboardReducer,
} from './slices/actionTracker';



export const store = configureStore({
  reducer: {
    auth: authReducer,
    menu: menuReducer,
    meetings: meetingReducer,
    participants: participantReducer,
    actions: actionReducer,
    dashboard: dashboardReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;