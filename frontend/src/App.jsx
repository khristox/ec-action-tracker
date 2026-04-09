import React, { useEffect, useState, useCallback, useRef, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { SnackbarProvider } from 'notistack';
import { Box, CircularProgress, Typography, Fade, useTheme, keyframes, Button } from '@mui/material';

// Slices & Selectors
import { checkAuth, clearError, selectAuth } from './store/slices/authSlice';

// Context & Theme
import { ThemeContextProvider } from './context/ThemeProvider';

// Components
import Layout from './components/common/Layout';

// Lazy Loaded Pages (Performance Optimization)
// Auth Pages
const SignInSide = lazy(() => import('./pages/SignInSide'));
const SignUp = lazy(() => import('./pages/SignUp'));

// Action Tracker - Dashboard
const Dashboard = lazy(() => import('./components/actiontracker/dashboard/Dashboard'));
//const Dashboard = lazy(() => import('./pages/Dashboard'));  // Use the working one


// Action Tracker - Meetings
const Meetings = lazy(() => import('./components/actiontracker/meetings/Meetings'));
const CreateMeeting = lazy(() => import('./components/actiontracker/meetings/CreateMeeting'));
const MeetingDetail = lazy(() => import('./components/actiontracker/meetings/MeetingDetail'));
const EditMeeting = lazy(() => import('./components/actiontracker/meetings/EditMeeting'));

// Action Tracker - Actions
const ActionsList = lazy(() => import('./components/actiontracker/actions/ActionsList'));
const MyTasks = lazy(() => import('./components/actiontracker/actions/MyTasks'));
const ActionDetail = lazy(() => import('./components/actiontracker/actions/ActionDetail'));

// Action Tracker - Participants
const ParticipantsLists = lazy(() => import('./components/actiontracker/participants/ParticipantsLists'));
const CreateParticipant = lazy(() => import('./components/actiontracker/participants/CreateParticipant'));
const ParticipantDetail = lazy(() => import('./components/actiontracker/participants/ParticipantDetail'));
const ParticipantLists = lazy(() => import('./components/actiontracker/participants/ParticipantsLists'));

// Action Tracker - Documents & Reports
const DocumentsList = lazy(() => import('./components/actiontracker/documents/DocumentsList'));
const ReportsList = lazy(() => import('./components/actiontracker/reports/ReportsList'));

// Action Tracker - Calendar & Settings
const CalendarView = lazy(() => import('./components/actiontracker/calendar/CalendarView'));
const Settings = lazy(() => import('./components/actiontracker/settings/Settings'));

// Error Pages
const NotFound = lazy(() => import('./pages/NotFound'));
const Forbidden = lazy(() => import('./pages/Forbidden'));

// Animations
const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
`;

const fadeInOut = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`;

/**
 * Enhanced Loading Screen
 */
const LoadingScreen = ({ message = 'Initializing System...', fullScreen = true }) => {
  const theme = useTheme();
  return (
    <Fade in timeout={500}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: fullScreen ? '100vh' : '100%',
          flexDirection: 'column',
          gap: 3,
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress 
          size={56} 
          thickness={4}
          sx={{ animation: `${pulse} 1.5s ease-in-out infinite` }}
        />
        <Typography 
          variant="h6" 
          color="text.secondary"
          sx={{ animation: `${fadeInOut} 1.5s ease-in-out infinite`, fontWeight: 500 }}
        >
          {message}
        </Typography>
      </Box>
    </Fade>
  );
};

/**
 * Role-Based Protected Route
 */
const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { isAuthenticated, isAuthChecking, user } = useSelector(selectAuth);
  const location = useLocation();

  if (isAuthChecking) return <LoadingScreen message="Verifying access..." fullScreen={false} />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles.length > 0) {
    const userRoles = user?.roles || [];
    const hasRole = requiredRoles.some(role => userRoles.includes(role));
    if (!hasRole) return <Navigate to="/forbidden" replace />;
  }

  return children;
};

/**
 * Public Only Route (Redirects to dashboard if logged in)
 */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isAuthChecking } = useSelector(selectAuth);
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  if (isAuthChecking) return <LoadingScreen message="Checking session..." fullScreen={false} />;
  return isAuthenticated ? <Navigate to={from} replace /> : children;
};

/**
 * Main Application Routing and Initialization
 */
const AppContent = () => {
  const dispatch = useDispatch();
  const { isAuthChecking } = useSelector(selectAuth);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const initCalled = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      if (initCalled.current) return;
      initCalled.current = true;

      try {
        // Attempt to restore session from token
        await dispatch(checkAuth()).unwrap();
      } catch (err) {
        // Note: 401/Missing token is handled silently. 
        // Only set an actual initError if the API itself is unreachable.
        if (err?.status === 0 || err?.code === 'ERR_NETWORK') {
          setInitError('Server unreachable. Please check your internet connection.');
        }
      } finally {
        setInitialized(true);
      }
    };

    initialize();
  }, [dispatch]);

  // Fatal Error UI
  if (initError) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', textAlign: 'center', p: 3 }}>
        <Typography variant="h4" color="error" gutterBottom>Critical Connection Error</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>{initError}</Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>Retry Connection</Button>
      </Box>
    );
  }

  if (!initialized) return <LoadingScreen message="Starting Application..." />;

  return (
    <Suspense fallback={<LoadingScreen message="Loading page components..." />}>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<PublicRoute><SignInSide /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
        
        {/* Protected App Routes */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          {/* Default Redirect */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          {/* Dashboard */}
          <Route path="dashboard" element={<Dashboard />} />
          
          {/* ==================== MEETINGS ROUTES ==================== */}
          <Route path="meetings" element={<Meetings />} />
          <Route path="meetings/create" element={<CreateMeeting />} />
          <Route path="meetings/:id" element={<MeetingDetail />} />
          <Route path="meetings/:id/edit" element={<EditMeeting />} />
          
          {/* ==================== ACTIONS ROUTES ==================== */}
          <Route path="actions" element={<ActionsList />} />
          <Route path="actions/my-tasks" element={<MyTasks />} />
          <Route path="actions/:id" element={<ActionDetail />} />
          
          {/* ==================== PARTICIPANTS ROUTES ==================== */}
          <Route path="participants" element={<ParticipantsLists />} />
          <Route path="participants/create" element={<CreateParticipant />} />
          <Route path="participants/:id" element={<ParticipantDetail />} />
          <Route path="participant-lists" element={<ParticipantLists />} />
          
          {/* ==================== DOCUMENTS ROUTES ==================== */}
          <Route path="documents" element={<DocumentsList />} />
          
          {/* ==================== REPORTS ROUTES ==================== */}
          <Route path="reports" element={<ReportsList />} />
          
          {/* ==================== CALENDAR & SETTINGS ==================== */}
          <Route path="calendar" element={<CalendarView />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/profile" element={<Settings />} />
          <Route path="settings/security" element={<Settings />} />
          <Route path="settings/notifications" element={<Settings />} />
          <Route path="settings/preferences" element={<Settings />} />
        </Route>

        {/* Error Pages */}
        <Route path="/403" element={<Forbidden />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
};

export default function App() {
  const baseUrl = import.meta.env.BASE_URL;
  return (
    <ThemeContextProvider>
      <SnackbarProvider 
        maxSnack={3} 
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        autoHideDuration={4000}
      >
        <Router basename={baseUrl}>
          <AppContent />
        </Router>
      </SnackbarProvider>
    </ThemeContextProvider>
  );
}