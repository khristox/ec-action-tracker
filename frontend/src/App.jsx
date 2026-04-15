import React, { 
  useEffect, 
  useState, 
  useRef, 
  Suspense, 
  lazy, 
  useCallback, 
  useMemo 
} from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { SnackbarProvider } from 'notistack';
import { Box, CircularProgress, Typography, Fade, keyframes, Button, LinearProgress, Alert } from '@mui/material';

// Slices & Selectors
import { checkAuth, selectAuth } from './store/slices/authSlice';

// Context & Theme
import { ThemeContextProvider } from './context/ThemeProvider';

// Components
import Layout from './components/common/Layout';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Component Error:', error?.message || error);
    console.error('Error Info:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', p: 3, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>Something went wrong</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

// Debug component to identify which lazy import is failing
const DebugLazy = ({ componentImport, componentName, fallback }) => {
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    componentImport()
      .then(module => {
        if (mounted) {
          setComponent(() => module.default || module);
        }
      })
      .catch(err => {
        console.error(`[DebugLazy] Failed to load ${componentName}:`, err);
        if (mounted) {
          setError(err);
        }
      });
    return () => { mounted = false; };
  }, [componentImport, componentName]);

  if (error) {
    return fallback || (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load component: {componentName}
        </Alert>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!Component) {
    return <LoadingScreen message={`Loading ${componentName}...`} fullScreen={false} />;
  }

  return <Component />;
};

// Improved lazy loading wrapper with better error handling
const lazyWithRetry = (componentImport, componentName) => {
  return lazy(() => 
    componentImport()
      .then(module => {
        console.log(`[Success] Loaded ${componentName}`);
        return module;
      })
      .catch((error) => {
        console.error(`[Failed] Could not load ${componentName}:`, error);
        // Log more details about the error
        console.error(`Error details:`, {
          message: error?.message,
          name: error?.name,
          code: error?.code,
          stack: error?.stack
        });
        
        // Try to reload the page once on chunk load failure
        if (error?.message?.includes('chunk') || 
            error?.message?.includes('loading') ||
            error?.code === 'CHUNK_LOAD_ERROR') {
          console.log(`[Retry] Reloading page for ${componentName}`);
          window.location.reload();
        }
        
        // Throw a more user-friendly error
        throw new Error(`Failed to load ${componentName}. Please refresh the page.`);
      })
  );
};

// Fallback component for when lazy loading fails
const FallbackComponent = ({ componentName }) => {
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography color="error" gutterBottom>
        Failed to load {componentName}
      </Typography>
      <Button variant="contained" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </Box>
  );
};

// Lazy Loaded Pages with retry capability - TEST EACH ONE
// Start with a test to see which component is failing
const testImport = async (path, name) => {
  try {
    console.log(`Testing import: ${name}`);
    const module = await import(path);
    console.log(`✓ ${name} loaded successfully`);
    return module;
  } catch (error) {
    console.error(`✗ ${name} failed to load:`, error);
    throw error;
  }
};

// Auth Pages
const SignInSide = lazyWithRetry(() => testImport('./pages/SignInSide', 'SignInSide'), 'SignInSide');
const SignUp = lazyWithRetry(() => testImport('./pages/SignUp', 'SignUp'), 'SignUp');

// Action Tracker - Dashboard
const Dashboard = lazyWithRetry(() => testImport('./components/actiontracker/dashboard/Dashboard', 'Dashboard'), 'Dashboard');

// Action Tracker - Meetings
const Meetings = lazyWithRetry(() => testImport('./components/actiontracker/meetings/Meetings', 'Meetings'), 'Meetings');
const CreateMeeting = lazyWithRetry(() => testImport('./components/actiontracker/meetings/CreateMeeting', 'CreateMeeting'), 'CreateMeeting');
const MeetingDetail = lazyWithRetry(() => testImport('./components/actiontracker/meetings/MeetingDetail', 'MeetingDetail'), 'MeetingDetail');
const EditMeeting = lazyWithRetry(() => testImport('./components/actiontracker/meetings/EditMeeting', 'EditMeeting'), 'EditMeeting');

// Action Tracker - Actions
const ActionsList = lazyWithRetry(() => testImport('./components/actiontracker/actions/ActionsList', 'ActionsList'), 'ActionsList');
const MyTasks = lazyWithRetry(() => testImport('./components/actiontracker/actions/MyTasks', 'MyTasks'), 'MyTasks');
const AllActions = lazyWithRetry(() => testImport('./components/actiontracker/actions/AllActions', 'AllActions'), 'AllActions');
const ActionDetail = lazyWithRetry(() => testImport('./components/actiontracker/actions/ActionDetail', 'ActionDetail'), 'ActionDetail');
const OverdueActions = lazyWithRetry(() => testImport('./components/actiontracker/actions/OverdueActions', 'OverdueActions'), 'OverdueActions');
const AssignAction = lazyWithRetry(() => testImport('./components/actiontracker/actions/AssignAction', 'AssignAction'), 'AssignAction');
const UpdateProgress = lazyWithRetry(() => testImport('./components/actiontracker/actions/UpdateProgress', 'UpdateProgress'), 'UpdateProgress');

// Action Tracker - Participants
const ParticipantsLists = lazyWithRetry(() => testImport('./components/actiontracker/participants/ParticipantsLists', 'ParticipantsLists'), 'ParticipantsLists');
const ParticipantListsManager = lazyWithRetry(() => testImport('./components/actiontracker/participants/ParticipantListsManager', 'ParticipantListsManager'), 'ParticipantListsManager');
const CreateParticipant = lazyWithRetry(() => testImport('./components/actiontracker/participants/CreateParticipant', 'CreateParticipant'), 'CreateParticipant');
const ParticipantDetail = lazyWithRetry(() => testImport('./components/actiontracker/participants/ParticipantDetail', 'ParticipantDetail'), 'ParticipantDetail');

// Action Tracker - Bulk Import
const BulkImportPage = lazyWithRetry(() => testImport('./components/actiontracker/participants/BulkImportPage', 'BulkImportPage'), 'BulkImportPage');

// Action Tracker - Documents & Reports
const DocumentsList = lazyWithRetry(() => testImport('./components/actiontracker/documents/DocumentsList', 'DocumentsList'), 'DocumentsList');
const ReportsList = lazyWithRetry(() => testImport('./components/actiontracker/reports/ReportsList', 'ReportsList'), 'ReportsList');

// Action Tracker - Calendar & Settings
const CalendarView = lazyWithRetry(() => testImport('./components/actiontracker/calendar/CalendarView', 'CalendarView'), 'CalendarView');
const Settings = lazyWithRetry(() => testImport('./components/actiontracker/settings/Settings', 'Settings'), 'Settings');

// Profile Components
const Profile = lazyWithRetry(() => testImport('./components/profile/Profile', 'Profile'), 'Profile');
const ProfileSettings = lazyWithRetry(() => testImport('./components/profile/ProfileSettings', 'ProfileSettings'), 'ProfileSettings');
const SecuritySettings = lazyWithRetry(() => testImport('./components/profile/SecuritySettings', 'SecuritySettings'), 'SecuritySettings');
const NotificationSettings = lazyWithRetry(() => testImport('./components/profile/NotificationSettings', 'NotificationSettings'), 'NotificationSettings');
const PreferenceSettings = lazyWithRetry(() => testImport('./components/profile/PreferenceSettings', 'PreferenceSettings'), 'PreferenceSettings');

// Admin Components
const UserManagement = lazyWithRetry(() => testImport('./components/admin/UserManagement', 'UserManagement'), 'UserManagement');
const RoleManagement = lazyWithRetry(() => testImport('./components/admin/RoleManagement', 'RoleManagement'), 'RoleManagement');
const AuditLogs = lazyWithRetry(() => testImport('./components/admin/AuditLogs', 'AuditLogs'), 'AuditLogs');

// Error Pages
const NotFound = lazyWithRetry(() => testImport('./pages/NotFound', 'NotFound'), 'NotFound');
const Forbidden = lazyWithRetry(() => testImport('./pages/Forbidden', 'Forbidden'), 'Forbidden');

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
const LoadingScreen = ({ message = 'Initializing System...', fullScreen = true, progress = null }) => {
  return (
    <Fade in timeout={500}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: fullScreen ? '100vh' : '100%',
          minHeight: fullScreen ? '100vh' : '400px',
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
        {progress !== null && (
          <Box sx={{ width: '200px', mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
        )}
      </Box>
    </Fade>
  );
};

/**
 * Role-Based Protected Route
 */
const ProtectedRoute = ({ children, requiredRoles = [], requiredPermissions = [] }) => {
  const { isAuthenticated, isAuthChecking, user } = useSelector(selectAuth);
  const location = useLocation();

  if (isAuthChecking) {
    return <LoadingScreen message="Verifying access..." fullScreen={false} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check roles
  if (requiredRoles.length > 0) {
    const userRoles = user?.roles || [];
    const hasRole = requiredRoles.some(role => userRoles.includes(role));
    if (!hasRole) {
      return <Navigate to="/forbidden" replace />;
    }
  }

  // Check permissions (if needed)
  if (requiredPermissions.length > 0) {
    const userPermissions = user?.permissions || [];
    const hasPermission = requiredPermissions.some(permission => userPermissions.includes(permission));
    if (!hasPermission) {
      return <Navigate to="/forbidden" replace />;
    }
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

  if (isAuthChecking) {
    return <LoadingScreen message="Checking session..." fullScreen={false} />;
  }
  
  return isAuthenticated ? <Navigate to={from} replace /> : children;
};

/**
 * Route configuration for better organization
 */
const routeConfig = {
  publicRoutes: [
    { path: "/login", element: <SignInSide />, wrapper: PublicRoute },
    { path: "/signup", element: <SignUp />, wrapper: PublicRoute },
  ],
  errorRoutes: [
    { path: "/403", element: <Forbidden /> },
    { path: "/404", element: <NotFound /> },
  ],
  protectedRoutes: [
    { path: "dashboard", element: <Dashboard /> },
    { path: "meetings", element: <Meetings /> },
    { path: "meetings/create", element: <CreateMeeting /> },
    { path: "meetings/:id", element: <MeetingDetail /> },
    { path: "meetings/:id/edit", element: <EditMeeting /> },
    { path: "actions", element: <ActionsList /> },
    { path: "actions/all", element: <AllActions /> },
    { path: "actions/my-tasks", element: <MyTasks /> },
    { path: "actions/:id", element: <ActionDetail /> },
    { path: "actions/overdue", element: <OverdueActions /> },
    { path: "actions/assign", element: <AssignAction /> },
    { path: "actions/:id/assign", element: <AssignAction /> },
    { path: "actions/progress", element: <UpdateProgress /> },
    { path: "actions/:id/progress", element: <UpdateProgress /> },
    { path: "participants", element: <ParticipantsLists /> },
    { path: "participants/create", element: <CreateParticipant /> },
    { path: "participants/:id", element: <ParticipantDetail /> },
    { path: "participants/:id/edit", element: <CreateParticipant /> },
    { path: "participants/import", element: <BulkImportPage /> },
    { path: "participant-lists", element: <ParticipantListsManager /> },
    { path: "participant-lists/:id", element: <ParticipantListsManager /> },
    { path: "participants/lists", element: <ParticipantListsManager /> },
    { path: "documents", element: <DocumentsList /> },
    { path: "documents/:category", element: <DocumentsList /> },
    { path: "reports", element: <ReportsList /> },
    { path: "reports/:type", element: <ReportsList /> },
    { path: "calendar", element: <CalendarView /> },
    { path: "profile", element: <Profile /> },
    { path: "profile/:tab", element: <Profile /> },
    { path: "settings", element: <Settings /> },
    { path: "settings/profile", element: <ProfileSettings /> },
    { path: "settings/security", element: <SecuritySettings /> },
    { path: "settings/notifications", element: <NotificationSettings /> },
    { path: "settings/preferences", element: <PreferenceSettings /> },
    { path: "settings/status", element: <Settings /> },
    { path: "settings/document-types", element: <Settings /> },
    // REMOVE these from here since they're in adminRoutes
     { path: "settings/users", element: <UserManagement /> },
    // { path: "settings/roles", element: <RoleManagement /> },
    // { path: "settings/audit", element: <AuditLogs /> },
  ],
  adminRoutes: [
    { path: "admin/users", element: <UserManagement />, roles: ['admin'] },
    { path: "admin/roles", element: <RoleManagement />, roles: ['admin'] },
    { path: "admin/audit", element: <AuditLogs />, roles: ['admin', 'auditor'] },
    // Add settings paths here with roles
    { path: "settings/users", element: <UserManagement />, roles: ['admin'] },
    { path: "settings/roles", element: <RoleManagement />, roles: ['admin'] },
    { path: "settings/audit", element: <AuditLogs />, roles: ['admin', 'auditor'] },
  ],
};

/**
 * Main Application Routing and Initialization
 */
const AppContent = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector(selectAuth);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const initCalled = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      if (initCalled.current) return;
      initCalled.current = true;

      setLoadingProgress(30);
      
      try {
        // Attempt to restore session from token
        setLoadingProgress(60);
        await dispatch(checkAuth()).unwrap();
        setLoadingProgress(100);
      } catch (err) {
        console.error('Initialization error:', err?.message || err);
        // Only set error for network issues, not for 401/403
        if (err?.status === 0 || err?.code === 'ERR_NETWORK') {
          setInitError('Unable to connect to the server. Please check your connection.');
        } else if (err?.status === 500) {
          setInitError('Server error. Please try again later.');
        }
        // Don't set error for auth failures - just continue
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
        <Typography variant="h4" color="error" gutterBottom>
          Connection Error
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {initError}
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => window.location.reload()}
          startIcon={<span>🔄</span>}
        >
          Retry Connection
        </Button>
      </Box>
    );
  }

  if (!initialized) {
    return <LoadingScreen message="Starting Application..." progress={loadingProgress} />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen message="Loading application..." />}>
        <Routes>
          {/* Public Routes */}
          {routeConfig.publicRoutes.map(({ path, element, wrapper: Wrapper }) => (
            <Route 
              key={path} 
              path={path} 
              element={<Wrapper>{element}</Wrapper>} 
            />
          ))}
          
          {/* Protected App Routes */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            {/* Standard Protected Routes */}
            {routeConfig.protectedRoutes.map(({ path, element }) => (
              <Route 
                key={path} 
                path={path} 
                element={
                  <Suspense fallback={<LoadingScreen message="Loading page..." fullScreen={false} />}>
                    {element}
                  </Suspense>
                } 
              />
            ))}
            
            {/* Admin Routes with Role Protection */}
            {routeConfig.adminRoutes.map(({ path, element, roles }) => (
              <Route 
                key={path} 
                path={path} 
                element={
                  <ProtectedRoute requiredRoles={roles}>
                    <Suspense fallback={<LoadingScreen message="Loading page..." fullScreen={false} />}>
                      {element}
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
            ))}
          </Route>

          {/* Error Routes */}
          {routeConfig.errorRoutes.map(({ path, element }) => (
            <Route 
              key={path} 
              path={path} 
              element={
                <Suspense fallback={<LoadingScreen message="Loading..." fullScreen={false} />}>
                  {element}
                </Suspense>
              } 
            />
          ))}
          
          {/* Catch-all Route */}
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

/**
 * Main App Component
 */
export default function App() {
  const baseUrl = import.meta.env.BASE_URL;
  
  // Log all imports on startup to see which ones fail
  useEffect(() => {
    console.log('App initializing...');
  }, []);
  
  return (
    <ThemeContextProvider>
      <SnackbarProvider 
        maxSnack={3} 
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        autoHideDuration={4000}
        preventDuplicate
      >
        <Router basename={baseUrl}>
          <AppContent />
        </Router>
      </SnackbarProvider>
    </ThemeContextProvider>
  );
}