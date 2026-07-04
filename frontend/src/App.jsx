// App.jsx - Improved version
// Key changes:
//   1. AuthReloader removed — it caused a timing race that prevented menu fetches
//   2. Route config cleaned up — adminRoutes deduplicated from protectedRoutes
//   3. preloadRoleBasedComponents called once, not twice
//   4. Minor cleanup throughout

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
import {
  Box, CircularProgress, Typography, Fade, keyframes,
  Button, LinearProgress
} from '@mui/material';

// Slices & Selectors
import { checkAuth, selectAuth } from './store/slices/authSlice';

// Context & Theme
import { ThemeContextProvider } from './context/ThemeProvider';

// Components
import Layout from './components/common/Layout';
import { MeetingRecorderProvider } from './context/MeetingRecorderContext';
import EditRecurringMeeting from './components/actiontracker/meetings/EditRecurringMeeting';

import { AdminStructures } from './components/admin/adminStructures';

import { fetchUserMenus } from './store/slices/menuSlice'; // if not already imported
import { selectAllowedMenuCodes, selectMenuLoading } from './store/slices/menuSlice';

// ==================== Error Boundary ====================

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
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          height: '100vh', flexDirection: 'column', p: 3, textAlign: 'center'
        }}>
          <Typography variant="h5" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()} startIcon={<span>🔄</span>}>
            Reload Page
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

// ==================== Static Import Map ====================

const COMPONENT_IMPORTS = {
  // Auth Pages
  'SignInSide':             () => import('./pages/SignInSide'),
  'SignUp':                 () => import('./pages/SignUp'),
  'ForgotPassword':         () => import('./components/auth/ForgotPassword'),
  'ResetPassword':          () => import('./components/auth/ResetPassword'),

  // Dashboard
  'Dashboard':              () => import('./components/actiontracker/dashboard/Dashboard'),

  // Meetings
  'Meetings':               () => import('./components/actiontracker/meetings/Meetings'),
  'CreateMeeting':          () => import('./components/actiontracker/meetings/CreateMeeting'),
  'MeetingDetail':          () => import('./components/actiontracker/meetings/MeetingDetail'),
  'EditMeeting':            () => import('./components/actiontracker/meetings/EditMeeting'),
  'MeetingForm':            () => import('./components/actiontracker/meetings/MeetingForm/MeetingForm'),
  'MeetingRecorder':        () => import('./components/actiontracker/meetings/MeetingRecorder'),

  'RecurringMeetingDetail': () => import('./components/actiontracker/meetings/RecurringMeetingDetail'),


  // Actions
  'ActionsList':            () => import('./components/actiontracker/actions/ActionsList'),
  'MyTasks':                () => import('./components/actiontracker/actions/MyTasks'),
  'AllActions':             () => import('./components/actiontracker/actions/AllActions'),
  'ActionDetail':           () => import('./components/actiontracker/actions/ActionDetail'),
  'OverdueActions':         () => import('./components/actiontracker/actions/OverdueActions'),
  'AssignAction':           () => import('./components/actiontracker/actions/AssignAction'),
  'UpdateProgress':         () => import('./components/actiontracker/actions/UpdateProgress'),

  // Participants
  'ParticipantsLists':      () => import('./components/actiontracker/participants/ParticipantsLists'),
  'ParticipantListsManager':() => import('./components/actiontracker/participants/ParticipantListsManager'),
  'CreateParticipant':      () => import('./components/actiontracker/participants/CreateParticipant'),
  'ParticipantDetail':      () => import('./components/actiontracker/participants/ParticipantDetail'),
  'BulkImportPage':         () => import('./components/actiontracker/participants/BulkImportPage'),

  // Documents & Reports
  'DocumentsList':          () => import('./components/actiontracker/documents/DocumentsList'),
  'ReportsList':            () => import('./components/actiontracker/reports/ReportsList'),

  // Calendar & Settings
  'CalendarView':           () => import('./components/actiontracker/calendar/CalendarView'),
  'Settings':               () => import('./components/actiontracker/settings/Settings'),
  'Locations':              () => import('./components/address/LocationManager'),

  // Profile
  'Profile':                () => import('./components/profile/ProfileSettings'),
  'ProfileSettings':        () => import('./components/profile/ProfileSettings'),
  'SecuritySettings':       () => import('./components/profile/SecuritySettings'),
  'NotificationSettings':   () => import('./components/profile/NotificationSettings'),
  'PreferenceSettings':     () => import('./components/profile/PreferenceSettings'),

  // Admin
  'UserManagement':         () => import('./components/admin/UserManagement'),
  'RoleManagement':         () => import('./components/admin/RoleManagement'),
  'RoleMenuAssignment':     () => import('./components/admin/RoleMenuAssignment'),
  'AuditLogs':              () => import('./components/admin/AuditLogs'),

  // Error Pages
  'NotFound':               () => import('./pages/NotFound'),
  'Forbidden':              () => import('./pages/Forbidden'),
};

// ==================== Lazy Loading ====================

const componentCache = new Map();

const loadComponent = async (componentName, retries = 2, retryDelay = 1000) => {
  if (componentCache.has(componentName)) {
    return componentCache.get(componentName);
  }

  const importFn = COMPONENT_IMPORTS[componentName];
  if (!importFn) throw new Error(`Component "${componentName}" not found in import map`);

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const module = await importFn();
      componentCache.set(componentName, Promise.resolve(module));
      return module;
    } catch (error) {
      lastError = error;
      console.error(`[Failed] Attempt ${attempt + 1} for ${componentName}:`, error);

      const isChunkError =
        error?.message?.includes('chunk') ||
        error?.message?.includes('loading') ||
        error?.code === 'CHUNK_LOAD_ERROR';

      if (isChunkError && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  throw new Error(`Failed to load ${componentName} after ${retries + 1} attempts: ${lastError?.message}`);
};

const createLazyComponent = (componentName, options = {}) => {
  const { retries = 2, retryDelay = 1000 } = options;

  if (!COMPONENT_IMPORTS[componentName]) {
    console.error(`Component "${componentName}" not found in import map`);
    return () => <div>Component "{componentName}" not found</div>;
  }

  return lazy(() => loadComponent(componentName, retries, retryDelay));
};

const RecurringMeetingDetail = createLazyComponent('RecurringMeetingDetail');


const preloadCriticalComponents = async () => {
  const critical = ['Dashboard', 'MyTasks', 'ActionsList'];
  await Promise.allSettled(
    critical.map(name => loadComponent(name, 1, 500).catch(err =>
      console.warn(`[Preload] Failed: ${name}`, err)
    ))
  );
};

const preloadRoleBasedComponents = async (userRoles) => {
  const roleComponents = {
    admin:   ['UserManagement', 'RoleManagement', 'RoleMenuAssignment', 'AuditLogs', 'Locations'],
    user:    ['Profile', 'ProfileSettings'],
    manager: ['ReportsList', 'CalendarView'],
  };

  const roleCodes = userRoles.map(role => typeof role === 'object' ? role.code : role);
  const toPreload = roleCodes.flatMap(code => roleComponents[code] || []);

  if (toPreload.length > 0) {
    await Promise.allSettled(
      toPreload.map(name => loadComponent(name, 1, 500).catch(err =>
        console.warn(`[Preload] Failed: ${name}`, err)
      ))
    );
  }
};

// ==================== Lazy Components ====================

// Auth
const SignInSide       = createLazyComponent('SignInSide');
const SignUp           = createLazyComponent('SignUp');
const ForgotPassword   = createLazyComponent('ForgotPassword');
const ResetPassword    = createLazyComponent('ResetPassword');

// Dashboard
const Dashboard        = createLazyComponent('Dashboard');

// Meetings
const Meetings         = createLazyComponent('Meetings');
const MeetingForm      = createLazyComponent('MeetingForm');
const CreateMeeting    = createLazyComponent('CreateMeeting');
const MeetingDetail    = createLazyComponent('MeetingDetail');
const EditMeeting      = createLazyComponent('EditMeeting');
const MeetingRecorder  = createLazyComponent('MeetingRecorder');

// Actions
const ActionsList      = createLazyComponent('ActionsList');
const MyTasks          = createLazyComponent('MyTasks');
const AllActions       = createLazyComponent('AllActions');
const ActionDetail     = createLazyComponent('ActionDetail');
const OverdueActions   = createLazyComponent('OverdueActions');
const AssignAction     = createLazyComponent('AssignAction');
const UpdateProgress   = createLazyComponent('UpdateProgress');

// Participants
const ParticipantsLists       = createLazyComponent('ParticipantsLists');
const ParticipantListsManager = createLazyComponent('ParticipantListsManager');
const CreateParticipant       = createLazyComponent('CreateParticipant');
const ParticipantDetail       = createLazyComponent('ParticipantDetail');
const BulkImportPage          = createLazyComponent('BulkImportPage');

// Documents & Reports
const DocumentsList    = createLazyComponent('DocumentsList');
const ReportsList      = createLazyComponent('ReportsList');

// Calendar & Settings
const CalendarView     = createLazyComponent('CalendarView');
const Settings         = createLazyComponent('Settings');
const Locations        = createLazyComponent('Locations');

// Profile
const Profile                = createLazyComponent('Profile');
const ProfileSettings        = createLazyComponent('ProfileSettings');
const SecuritySettings       = createLazyComponent('SecuritySettings');
const NotificationSettings   = createLazyComponent('NotificationSettings');
const PreferenceSettings     = createLazyComponent('PreferenceSettings');

// Admin
const UserManagement    = createLazyComponent('UserManagement');
const RoleManagement    = createLazyComponent('RoleManagement');
const RoleMenuAssignment= createLazyComponent('RoleMenuAssignment');
const AuditLogs         = createLazyComponent('AuditLogs');
//const AdminStructures     = createLazyComponent('AdminStructures');

// Error Pages
const NotFound  = createLazyComponent('NotFound');
const Forbidden = createLazyComponent('Forbidden');

// ==================== Animations ====================

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50%       { transform: scale(1.05); opacity: 0.8; }
`;

const fadeInOut = keyframes`
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
`;

// ==================== Loading Screen ====================

const LoadingScreen = ({ message = 'Initializing System...', fullScreen = true, progress = null }) => (
  <Fade in timeout={500}>
    <Box sx={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: fullScreen ? '100vh' : '100%',
      minHeight: fullScreen ? '100vh' : '400px',
      flexDirection: 'column', gap: 3,
      bgcolor: 'background.default',
    }}>
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

// ==================== Recording Route Wrapper ====================
// Provides MeetingRecorderContext ONLY for the recording route so the
// browser microphone prompt is never triggered on other pages.

const RecordingRouteWrapper = ({ children }) => (
  <MeetingRecorderProvider>
    {children}
  </MeetingRecorderProvider>
);

// ==================== Protected Route ====================

const ProtectedRoute = ({ children, requiredRoles = [], requiredPermissions = [] }) => {
  const { isAuthenticated, isAuthChecking, user } = useSelector(selectAuth);
  const location = useLocation();

  // Preload role-based components as soon as we know who the user is
  useEffect(() => {
    if (user?.roles?.length > 0) {
      preloadRoleBasedComponents(user.roles);
    }
  }, [user]);

  if (isAuthChecking) {
    return <LoadingScreen message="Verifying access..." fullScreen={false} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles.length > 0) {
    const userRoleCodes = (user?.roles || []).map(r => typeof r === 'object' ? r.code : r);
    const hasRole = requiredRoles.some(r => userRoleCodes.includes(r));
    if (!hasRole) return <Navigate to="/forbidden" replace />;
  }

  if (requiredPermissions.length > 0) {
    const userPermissions = user?.permissions || [];
    const hasPermission = requiredPermissions.some(p => userPermissions.includes(p));
    if (!hasPermission) return <Navigate to="/forbidden" replace />;
  }

  return children;
};


const MenuProtectedRoute = ({ children, menuCode }) => {
  const allowedMenuCodes = useSelector(selectAllowedMenuCodes);
  const menusLoading = useSelector(selectMenuLoading);

  // Not gated — nothing to check
  if (!menuCode) return children;

  // Menus haven't loaded yet — don't flash a false 403 while the fetch is in flight
  if (menusLoading) {
    return <LoadingScreen message="Checking access..." fullScreen={false} />;
  }

  if (!allowedMenuCodes.has(menuCode)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
};
// ==================== Public Route ====================

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isAuthChecking } = useSelector(selectAuth);
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  if (isAuthChecking) {
    return <LoadingScreen message="Checking session..." fullScreen={false} />;
  }

  return isAuthenticated ? <Navigate to={from} replace /> : children;
};

// ==================== Route Config ====================
// Admin routes that also appear in protectedRoutes have been removed from
// adminRoutes to avoid duplicate route registration.

const routeConfig = {
  publicRoutes: [
    { path: '/login',                   element: <SignInSide />,     wrapper: PublicRoute },
    { path: '/signup',                  element: <SignUp />,         wrapper: PublicRoute },
    { path: '/forgot-password',         element: <ForgotPassword />, wrapper: PublicRoute },
    { path: '/reset-password/:token',   element: <ResetPassword />,  wrapper: PublicRoute },
  ],

  errorRoutes: [
    { path: '/403', element: <Forbidden /> },
    { path: '/404', element: <NotFound /> },
  ],

  // ONLY the recording page gets MeetingRecorderProvider (microphone prompt)
  recordingRoutes: [
    { path: 'meetings/:id/record', element: <MeetingRecorder /> },
  ],

  // Regular meeting routes — no microphone access
  regularMeetingRoutes: [
    { path: 'meetings',             element: <Meetings /> },
    { path: 'meetings/create',      element: <MeetingForm /> },
    { path: 'meetings/:id',         element: <MeetingDetail /> },
    { path: 'meetings/:id/edit',    element: <MeetingForm /> },
  ],

    // ADD RECURRING MEETING ROUTES HERE
  recurringMeetingRoutes: [
    { path: 'recurring-meetings',               element: <Meetings /> },  // Use same Meetings component
    { path: 'recurring-meetings/create',        element: <MeetingForm /> }, // Use same form with recurring flag
    { path: 'recurring-meetings/:id',           element: <RecurringMeetingDetail /> }, // Use same detail with recurring flag
    { path: 'recurring-meetings/:id/edit',      element: <EditRecurringMeeting /> }, // Use same form with recurring flag
  ],

  // Standard protected routes
  protectedRoutes: [
  { path: 'dashboard',                          element: <Dashboard /> }, // ungated
  { path: 'actions',                            element: <ActionsList />,   menuCode: 'actions' },
  { path: 'actions/all',                        element: <AllActions />,    menuCode: 'actions' },
  { path: 'actions/my-tasks',                   element: <MyTasks />,       menuCode: 'actions' },
  { path: 'actions/:id',                        element: <ActionDetail />,  menuCode: 'actions' },
  { path: 'actions/overdue',                    element: <OverdueActions />,menuCode: 'actions' },
  { path: 'actions/assign',                     element: <AssignAction />,  menuCode: 'actions' },
  { path: 'actions/assign/minute/:minuteId',    element: <AssignAction />,  menuCode: 'actions' },
  { path: 'actions/edit/:id',                   element: <AssignAction />,  menuCode: 'actions' },
  { path: 'actions/:id/assign',                 element: <AssignAction />,  menuCode: 'actions' },
  { path: 'actions/progress',                   element: <UpdateProgress />,menuCode: 'actions' },
  { path: 'actions/:id/progress',               element: <UpdateProgress />,menuCode: 'actions' },
  { path: 'participants',                       element: <ParticipantsLists />,       menuCode: 'participants' },
  { path: 'participants/create',                element: <CreateParticipant />,       menuCode: 'participants' },
  { path: 'participants/:id',                   element: <ParticipantDetail />,       menuCode: 'participants' },
  { path: 'participants/:id/edit',              element: <CreateParticipant />,       menuCode: 'participants' },
  { path: 'participants/import',                element: <BulkImportPage />,          menuCode: 'participants' },
  { path: 'participant-lists',                  element: <ParticipantListsManager />, menuCode: 'participants' },
  { path: 'participant-lists/:id',              element: <ParticipantListsManager />, menuCode: 'participants' },
  { path: 'participants/lists',                 element: <ParticipantListsManager />, menuCode: 'participants' },
  { path: 'documents',                          element: <DocumentsList />, menuCode: 'documents' },
  { path: 'documents/:category',                element: <DocumentsList />, menuCode: 'documents' },
  { path: 'reports',                            element: <ReportsList />,   menuCode: 'reports' },
  { path: 'reports/:type',                      element: <ReportsList />,   menuCode: 'reports' },
  { path: 'calendar',                           element: <CalendarView />,  menuCode: 'calendar' },
  { path: 'profile',                            element: <Profile /> }, // ungated
  { path: 'profile/:tab',                       element: <Profile /> }, // ungated
  { path: 'settings',                           element: <Settings /> }, // ungated
  { path: 'settings/profile',                   element: <ProfileSettings /> }, // ungated
  { path: 'settings/locations',                 element: <Locations />,      menuCode: 'locations' },
  { path: 'settings/security',                  element: <SecuritySettings /> }, // ungated
  { path: 'settings/notifications',             element: <NotificationSettings /> }, // ungated
  { path: 'settings/preferences',               element: <PreferenceSettings /> }, // ungated
  { path: 'settings/status',                    element: <Settings /> },
  { path: 'settings/document-types',            element: <Settings /> },
  { path: 'settings/users',                     element: <UserManagement />,       menuCode: 'admin_users' },
  { path: 'settings/roles',                     element: <RoleManagement />,       menuCode: 'admin_roles' },
  { path: 'settings/audit',                     element: <AuditLogs />,            menuCode: 'admin_audit' },
  { path: 'settings/role-menu-assignment',      element: <RoleMenuAssignment />,   menuCode: 'admin_role_menu' },
  { path: 'settings/admin-structures/departments', element: <AdminStructures />,   menuCode: 'admin_structures' },
  ],

  adminRoutes: [
    { path: 'admin/users',  element: <UserManagement />, roles: ['admin'],            menuCode: 'admin_users' },
    { path: 'admin/roles',  element: <RoleManagement />, roles: ['admin'],            menuCode: 'admin_roles' },
    { path: 'admin/audit',  element: <AuditLogs />,      roles: ['admin', 'auditor'], menuCode: 'admin_audit' },
  ],

};

// ==================== Suspense wrapper helper ====================

const Lazy = ({ message = 'Loading page...', children }) => (
  <Suspense fallback={<LoadingScreen message={message} fullScreen={false} />}>
    {children}
  </Suspense>
);

// ==================== AppContent ====================

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
        setLoadingProgress(60);
        await dispatch(checkAuth()).unwrap();
        setLoadingProgress(80);

        await preloadCriticalComponents();
        setLoadingProgress(100);
      } catch (err) {
        console.error('Initialization error:', err?.message || err);
        if (err?.status === 0 || err?.code === 'ERR_NETWORK') {
          setInitError('Unable to connect to the server. Please check your connection.');
        } else if (err?.status === 500) {
          setInitError('Server error. Please try again later.');
        }
        // Non-network errors (e.g. 401 unauthenticated) are not fatal —
        // the app still loads and the user will be redirected to /login.
      } finally {
        setInitialized(true);
      }
    };

    initialize();
  }, [dispatch]);

  if (initError) {
    return (
      <Box sx={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', flexDirection: 'column', textAlign: 'center', p: 3
      }}>
        <Typography variant="h4" color="error" gutterBottom>Connection Error</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {initError}
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()} startIcon={<span>🔄</span>}>
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
            <Route key={path} path={path} element={<Wrapper>{element}</Wrapper>} />
          ))}

          {/* Protected App Routes */}
          {/* NOTE: AuthReloader has been removed. The Sidebar manages its own
              menu fetch lifecycle via two separate useEffect hooks that watch
              isLoggedIn and user.id independently. Adding AuthReloader here
              caused a timing race where the Sidebar would mount before Redux
              had propagated isLoggedIn=true, causing the fetch to be skipped. */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Regular Meeting Routes — no MeetingRecorderProvider */}
            {routeConfig.regularMeetingRoutes.map(({ path, element }) => (
              <Route
                key={path}
                path={path}
                element={<Lazy message="Loading meeting page...">{element}</Lazy>}
              />
            ))}


            {/* ADD RECURRING MEETING ROUTES HERE */}
            {routeConfig.recurringMeetingRoutes.map(({ path, element }) => (
              <Route
                key={path}
                path={path}
                element={<Lazy message="Loading recurring meeting page...">{element}</Lazy>}
              />
            ))}

            {/* Recording Route ONLY — MeetingRecorderProvider here triggers mic prompt */}
            {routeConfig.recordingRoutes.map(({ path, element }) => (
              <Route
                key={path}
                path={path}
                element={
                  <RecordingRouteWrapper>
                    <Lazy message="Loading recorder...">{element}</Lazy>
                  </RecordingRouteWrapper>
                }
              />
            ))}


      {/* Standard Protected Routes */}
      {routeConfig.protectedRoutes.map(({ path, element, menuCode }) => (
        <Route
          key={path}
          path={path}
          element={
            <MenuProtectedRoute menuCode={menuCode}>
              <Lazy>{element}</Lazy>
            </MenuProtectedRoute>
          }
        />
      ))}

      {/* Admin Routes — role-guarded AND menu-guarded */}
      {routeConfig.adminRoutes.map(({ path, element, roles, menuCode }) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute requiredRoles={roles}>
              <MenuProtectedRoute menuCode={menuCode}>
                <Lazy>{element}</Lazy>
              </MenuProtectedRoute>
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
              element={<Lazy message="Loading...">{element}</Lazy>}
            />
          ))}

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

// ==================== Main App ====================

export default function App() {
  const baseUrl = import.meta.env.BASE_URL;

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