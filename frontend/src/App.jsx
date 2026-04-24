// App.jsx - Improved Solution 2

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

// Error Boundary Component (same as before)
// Error Boundary Component - Fixed
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
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh', 
          flexDirection: 'column', 
          p: 3, 
          textAlign: 'center' 
        }}>
          <Typography variant="h5" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
            startIcon={<span>🔄</span>}
          >
            Reload Page
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

// ========== IMPROVED STATIC IMPORT MAP ==========

/**
 * Static import map for all lazy-loaded components
 * This eliminates Vite warnings and provides better bundling
 */
const COMPONENT_IMPORTS = {
  // Auth Pages
  'SignInSide': () => import('./pages/SignInSide'),
  'SignUp': () => import('./pages/SignUp'),
  
  // Action Tracker - Dashboard
  'Dashboard': () => import('./components/actiontracker/dashboard/Dashboard'),
  
  // Action Tracker - Meetings
  'Meetings': () => import('./components/actiontracker/meetings/Meetings'),
  'CreateMeeting': () => import('./components/actiontracker/meetings/CreateMeeting'),
  'MeetingDetail': () => import('./components/actiontracker/meetings/MeetingDetail'),
  'EditMeeting': () => import('./components/actiontracker/meetings/EditMeeting'),

   'MeetingForm': () => import('./components/actiontracker/meetings/MeetingForm'),
  
   
  // Action Tracker - Actions
  'ActionsList': () => import('./components/actiontracker/actions/ActionsList'),
  'MyTasks': () => import('./components/actiontracker/actions/MyTasks'),
  'AllActions': () => import('./components/actiontracker/actions/AllActions'),
  'ActionDetail': () => import('./components/actiontracker/actions/ActionDetail'),
  'OverdueActions': () => import('./components/actiontracker/actions/OverdueActions'),
  'AssignAction': () => import('./components/actiontracker/actions/AssignAction'),
  'UpdateProgress': () => import('./components/actiontracker/actions/UpdateProgress'),
  
  // Action Tracker - Participants
  'ParticipantsLists': () => import('./components/actiontracker/participants/ParticipantsLists'),
  'ParticipantListsManager': () => import('./components/actiontracker/participants/ParticipantListsManager'),
  'CreateParticipant': () => import('./components/actiontracker/participants/CreateParticipant'),
  'ParticipantDetail': () => import('./components/actiontracker/participants/ParticipantDetail'),
  'BulkImportPage': () => import('./components/actiontracker/participants/BulkImportPage'),
  
  // Action Tracker - Documents & Reports
  'DocumentsList': () => import('./components/actiontracker/documents/DocumentsList'),
  'ReportsList': () => import('./components/actiontracker/reports/ReportsList'),
  
  // Action Tracker - Calendar & Settings
  'CalendarView': () => import('./components/actiontracker/calendar/CalendarView'),
  'Settings': () => import('./components/actiontracker/settings/Settings'),
  'Locations': () => import('./components/address/LocationManager'),

  
  // Profile Components
  'Profile': () => import('./components/profile/Profile'),
  'ProfileSettings': () => import('./components/profile/ProfileSettings'),
  'SecuritySettings': () => import('./components/profile/SecuritySettings'),
  'NotificationSettings': () => import('./components/profile/NotificationSettings'),
  'PreferenceSettings': () => import('./components/profile/PreferenceSettings'),
  
  // Admin Components
  'UserManagement': () => import('./components/admin/UserManagement'),
  'RoleManagement': () => import('./components/admin/RoleManagement'),
  'AuditLogs': () => import('./components/admin/AuditLogs'),
  
  // Error Pages
  'NotFound': () => import('./pages/NotFound'),
  'Forbidden': () => import('./pages/Forbidden'),
};

// Component cache for already loaded components
const componentCache = new Map();

// Preload queue for components that will likely be needed
const preloadQueue = new Set();

/**
 * Enhanced lazy loading with retry and preloading capabilities
 */
const createLazyComponent = (componentName, options = {}) => {
  const { preload = false, retries = 2, retryDelay = 1000 } = options;
  
  // Get the import function
  const importFn = COMPONENT_IMPORTS[componentName];
  
  if (!importFn) {
    console.error(`Component "${componentName}" not found in import map`);
    return () => <div>Component "{componentName}" not found</div>;
  }
  
  // Preload if requested
  if (preload && !componentCache.has(componentName)) {
    preloadQueue.add(componentName);
    // Don't await, just start loading in background
    loadComponent(componentName, retries, retryDelay).catch(err => {
      console.warn(`Preload failed for ${componentName}:`, err);
    });
  }
  
  // Return lazy component
  return lazy(() => loadComponent(componentName, retries, retryDelay));
};

/**
 * Load component with retry logic and caching
 */
const loadComponent = async (componentName, retries = 2, retryDelay = 1000) => {
  // Check cache first
  if (componentCache.has(componentName)) {
    return componentCache.get(componentName);
  }
  
  const importFn = COMPONENT_IMPORTS[componentName];
  if (!importFn) {
    throw new Error(`Component "${componentName}" not found in import map`);
  }
  
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[Load] Loading ${componentName}${attempt > 0 ? ` (retry ${attempt})` : ''}`);
      
      const module = await importFn();
      const Component = module.default || module;
      
      // Cache the component
      componentCache.set(componentName, Promise.resolve(module));
      
      console.log(`[Success] Loaded ${componentName}`);
      return module;
      
    } catch (error) {
      lastError = error;
      console.error(`[Failed] Attempt ${attempt + 1} for ${componentName}:`, error);
      
      // Check if it's a chunk loading error
      const isChunkError = error?.message?.includes('chunk') || 
                          error?.message?.includes('loading') ||
                          error?.code === 'CHUNK_LOAD_ERROR';
      
      if (isChunkError && attempt < retries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
      
      break;
    }
  }
  
  // All retries failed
  const errorMessage = `Failed to load ${componentName} after ${retries + 1} attempts: ${lastError?.message}`;
  console.error(errorMessage);
  throw new Error(errorMessage);
};

/**
 * Preload critical components after initial load
 */
const preloadCriticalComponents = async () => {
  const criticalComponents = ['Dashboard', 'MyTasks', 'ActionsList'];
  
  console.log('[Preload] Starting preload of critical components');
  
  const preloadPromises = criticalComponents.map(componentName => 
    loadComponent(componentName, 1, 500).catch(err => 
      console.warn(`[Preload] Failed to preload ${componentName}:`, err)
    )
  );
  
  await Promise.allSettled(preloadPromises);
  console.log('[Preload] Critical components preloaded');
};

/**
 * Preload components based on user role
 */
const preloadRoleBasedComponents = async (userRoles) => {
  const roleComponents = {
    admin: ['UserManagement', 'RoleManagement', 'AuditLogs','Locations'],
    user: ['Profile', 'ProfileSettings'],
    manager: ['ReportsList', 'CalendarView']
  };
  
  const componentsToPreload = [];
  
  for (const role of userRoles) {
    if (roleComponents[role]) {
      componentsToPreload.push(...roleComponents[role]);
    }
  }
  
  if (componentsToPreload.length > 0) {
    console.log('[Preload] Preloading role-based components:', componentsToPreload);
    
    const preloadPromises = componentsToPreload.map(componentName =>
      loadComponent(componentName, 1, 500).catch(err =>
        console.warn(`[Preload] Failed to preload ${componentName}:`, err)
      )
    );
    
    await Promise.allSettled(preloadPromises);
  }
};

// ========== Create Lazy Components ==========

// Auth Pages
const SignInSide = createLazyComponent('SignInSide');
const SignUp = createLazyComponent('SignUp');

// Action Tracker - Dashboard
const Dashboard = createLazyComponent('Dashboard', { preload: true });

// Action Tracker - Meetings
const Meetings = createLazyComponent('Meetings');
const MeetingForm = createLazyComponent('MeetingForm');
const CreateMeeting = createLazyComponent('CreateMeeting');
const MeetingDetail = createLazyComponent('MeetingDetail');
const EditMeeting = createLazyComponent('EditMeeting');

// Action Tracker - Actions
const ActionsList = createLazyComponent('ActionsList', { preload: true });
const MyTasks = createLazyComponent('MyTasks', { preload: true });
const AllActions = createLazyComponent('AllActions');
const ActionDetail = createLazyComponent('ActionDetail');
const OverdueActions = createLazyComponent('OverdueActions');
const AssignAction = createLazyComponent('AssignAction');
const UpdateProgress = createLazyComponent('UpdateProgress');

// Action Tracker - Participants
const ParticipantsLists = createLazyComponent('ParticipantsLists');
const ParticipantListsManager = createLazyComponent('ParticipantListsManager');
const CreateParticipant = createLazyComponent('CreateParticipant');
const ParticipantDetail = createLazyComponent('ParticipantDetail');
const BulkImportPage = createLazyComponent('BulkImportPage');

// Action Tracker - Documents & Reports
const DocumentsList = createLazyComponent('DocumentsList');
const ReportsList = createLazyComponent('ReportsList');

// Action Tracker - Calendar & Settings
const CalendarView = createLazyComponent('CalendarView');
const Settings = createLazyComponent('Settings');
const Locations = createLazyComponent('Locations');

// Profile Components
const Profile = createLazyComponent('Profile');
const ProfileSettings = createLazyComponent('ProfileSettings');
const SecuritySettings = createLazyComponent('SecuritySettings');
const NotificationSettings = createLazyComponent('NotificationSettings');
const PreferenceSettings = createLazyComponent('PreferenceSettings');

// Admin Components
const UserManagement = createLazyComponent('UserManagement');
const RoleManagement = createLazyComponent('RoleManagement');
const AuditLogs = createLazyComponent('AuditLogs');

// Error Pages
const NotFound = createLazyComponent('NotFound');
const Forbidden = createLazyComponent('Forbidden');

// Animations (keep your existing animations)
const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
`;

const fadeInOut = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`;

/**
 * Enhanced Loading Screen with progress indication
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
 * Role-Based Protected Route with preloading
 */
const ProtectedRoute = ({ children, requiredRoles = [], requiredPermissions = [] }) => {
  const { isAuthenticated, isAuthChecking, user } = useSelector(selectAuth);
  const location = useLocation();
  
  // Preload role-based components when user is loaded
  useEffect(() => {
    if (user?.roles && user.roles.length > 0) {
      preloadRoleBasedComponents(user.roles);
    }
  }, [user]);

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

  // Check permissions
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
 * Public Only Route
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
 * Route configuration
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
    { path: "meetings/create", element: <MeetingForm /> },
    { path: "meetings/:id", element: <MeetingDetail /> },
    { path: "meetings/:id/edit", element: <MeetingForm /> },
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
    { path: "settings/locations", element: <Locations /> },
    { path: "settings/security", element: <SecuritySettings /> },
    { path: "settings/notifications", element: <NotificationSettings /> },
    { path: "settings/preferences", element: <PreferenceSettings /> },
    { path: "settings/status", element: <Settings /> },
    { path: "settings/document-types", element: <Settings /> },
    { path: "settings/users", element: <UserManagement /> },
    { path: "settings/roles", element: <RoleManagement /> },
    { path: "settings/audit", element: <AuditLogs /> },
  ],
  adminRoutes: [
    { path: "admin/users", element: <UserManagement />, roles: ['admin'] },
    { path: "admin/roles", element: <RoleManagement />, roles: ['admin'] },
    { path: "admin/audit", element: <AuditLogs />, roles: ['admin', 'auditor'] },
    { path: "settings/users", element: <UserManagement />, roles: ['admin'] },
    { path: "settings/roles", element: <RoleManagement />, roles: ['admin'] },
    { path: "settings/audit", element: <AuditLogs />, roles: ['admin', 'auditor'] },
  ],
};

/**
 * AppContent Component with preloading on initialization
 */
const AppContent = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(selectAuth);
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
        setLoadingProgress(80);
        
        // Preload critical components after auth check
        await preloadCriticalComponents();
        setLoadingProgress(100);
        
      } catch (err) {
        console.error('Initialization error:', err?.message || err);
        if (err?.status === 0 || err?.code === 'ERR_NETWORK') {
          setInitError('Unable to connect to the server. Please check your connection.');
        } else if (err?.status === 500) {
          setInitError('Server error. Please try again later.');
        }
      } finally {
        setInitialized(true);
      }
    };

    initialize();
  }, [dispatch]);

  // Preload role-based components when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.roles) {
      preloadRoleBasedComponents(user.roles);
    }
  }, [isAuthenticated, user]);

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
          // In your App.jsx or router configuration
          <Route path="/actions/assign/minute/:minuteId" element={<AssignAction />} />
          <Route path="/actions/edit/:id" element={<AssignAction />} />
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
  
  useEffect(() => {
    console.log('App initializing...');
    console.log(`[Config] Environment: ${import.meta.env.MODE}`);
    console.log(`[Config] Base URL: ${baseUrl}`);
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