// App.jsx - Improved version
import React, {
  useEffect,
  useState,
  useRef,
  Suspense,
  lazy
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
  'SignInSide':             () => import('./pages/SignInSide'),
  'SignUp':                 () => import('./pages/SignUp'),
  'ForgotPassword':         () => import('./components/auth/ForgotPassword'),
  'ResetPassword':          () => import('./components/auth/ResetPassword'),
  'Dashboard':              () => import('./components/actiontracker/dashboard/Dashboard'),
  'Meetings':               () => import('./components/actiontracker/meetings/Meetings'),
  'CreateMeeting':          () => import('./components/actiontracker/meetings/CreateMeeting'),
  'MeetingDetail':          () => import('./components/actiontracker/meetings/MeetingDetail'),
  'EditMeeting':            () => import('./components/actiontracker/meetings/EditMeeting'),
  'MeetingForm':            () => import('./components/actiontracker/meetings/MeetingForm/MeetingForm'),
  'MeetingRecorder':        () => import('./components/actiontracker/meetings/MeetingRecorder'),
  'MeetingEmailNotifications': () => import('./components/actiontracker/meetings/components/meetings/MeetingEmailNotifications'),
  'RecurringMeetingDetail': () => import('./components/actiontracker/meetings/RecurringMeetingDetail'),
  'ActionsList':            () => import('./components/actiontracker/actions/ActionsList'),
  'MyTasks':                () => import('./components/actiontracker/actions/MyTasks'),
  'AllActions':             () => import('./components/actiontracker/actions/AllActions'),
  'ActionDetail':           () => import('./components/actiontracker/actions/ActionDetail'),
  'OverdueActions':         () => import('./components/actiontracker/actions/OverdueActions'),
  'AssignAction':           () => import('./components/actiontracker/actions/AssignAction'),
  'UpdateProgress':         () => import('./components/actiontracker/actions/UpdateProgress'),
  'ParticipantsLists':      () => import('./components/actiontracker/participants/ParticipantsLists'),
  'ParticipantListsManager':() => import('./components/actiontracker/participants/ParticipantListsManager'),
  'CreateParticipant':      () => import('./components/actiontracker/participants/CreateParticipant'),
  'ParticipantDetail':      () => import('./components/actiontracker/participants/ParticipantDetail'),
  'BulkImportPage':         () => import('./components/actiontracker/participants/BulkImportPage'),
  'DocumentsList':          () => import('./components/actiontracker/documents/DocumentsList'),
  'ReportsList':            () => import('./components/actiontracker/reports/ReportsList'),
  'CalendarView':           () => import('./components/actiontracker/calendar/CalendarView'),
  'Settings':               () => import('./components/actiontracker/settings/Settings'),
  'Locations':              () => import('./components/address/LocationManager'),
  'Profile':                () => import('./components/profile/ProfileSettings'),
  'ProfileSettings':        () => import('./components/profile/ProfileSettings'),
  'SecuritySettings':       () => import('./components/profile/SecuritySettings'),
  'NotificationSettings':   () => import('./components/profile/NotificationSettings'),
  'PreferenceSettings':     () => import('./components/profile/PreferenceSettings'),
  'UserManagement':         () => import('./components/admin/UserManagement'),
  'RoleManagement':         () => import('./components/admin/RoleManagement'),
  'RoleMenuAssignment':     () => import('./components/admin/RoleMenuAssignment'),
  'AuditLogs':              () => import('./components/admin/AuditLogs'),
  'NotFound':               () => import('./pages/NotFound'),
  'Forbidden':              () => import('./pages/Forbidden'),
};

// ==================== Lazy Loading Helpers ====================
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

// Fix: Wrap the critical preloader pool in a structural race limit so asset delays don't block initialization.
const preloadCriticalComponents = async () => {
  const critical = ['Dashboard', 'MyTasks', 'ActionsList'];
  try {
    await withTimeout(
      Promise.allSettled(
        critical.map(name => loadComponent(name, 1, 500).catch(err =>
          console.warn(`[Preload Critical Non-Fatal Exception]: ${name}`, err)
        ))
      ),
      5000,
      'preloadCriticalComponents()'
    );
  } catch (timeoutErr) {
    console.warn('[Preload Timeout Warning] Preloading took too long; continuing application mount safely.', timeoutErr);
  }
};

const preloadRoleBasedComponents = async (userRoles, isSuperuser) => {
  const roleComponents = {
    admin:   ['UserManagement', 'RoleManagement', 'RoleMenuAssignment', 'AuditLogs', 'Locations'],
    user:    ['Profile', 'ProfileSettings'],
    manager: ['ReportsList', 'CalendarView'],
  };
  const roleCodes = (userRoles || []).map(role => typeof role === 'object' ? role.code : role);
  const toPreload = roleCodes.flatMap(code => roleComponents[code] || []);
  if (isSuperuser) {
    toPreload.push(...roleComponents.admin);
  }
  const uniqueToPreload = [...new Set(toPreload)];
  if (uniqueToPreload.length > 0) {
    await Promise.allSettled(
      uniqueToPreload.map(name => loadComponent(name, 1, 500).catch(err =>
        console.warn(`[Preload Role Non-Fatal Exception]: ${name}`, err)
      ))
    );
  }
};

// ==================== Lazy Component Initializations ====================
const SignInSide       = createLazyComponent('SignInSide');
const SignUp           = createLazyComponent('SignUp');
const ForgotPassword   = createLazyComponent('ForgotPassword');
const ResetPassword    = createLazyComponent('ResetPassword');
const Dashboard        = createLazyComponent('Dashboard');
const Meetings         = createLazyComponent('Meetings');
const MeetingForm      = createLazyComponent('MeetingForm');
const CreateMeeting    = createLazyComponent('CreateMeeting');
const MeetingDetail    = createLazyComponent('MeetingDetail');
const EditMeeting      = createLazyComponent('EditMeeting');
const MeetingRecorder  = createLazyComponent('MeetingRecorder');
const MeetingEmailNotifications = createLazyComponent('MeetingEmailNotifications');
const ActionsList      = createLazyComponent('ActionsList');
const MyTasks          = createLazyComponent('MyTasks');
const AllActions       = createLazyComponent('AllActions');
const ActionDetail     = createLazyComponent('ActionDetail');
const OverdueActions   = createLazyComponent('OverdueActions');
const AssignAction     = createLazyComponent('AssignAction');
const UpdateProgress   = createLazyComponent('UpdateProgress');
const ParticipantsLists       = createLazyComponent('ParticipantsLists');
const ParticipantListsManager = createLazyComponent('ParticipantListsManager');
const CreateParticipant       = createLazyComponent('CreateParticipant');
const ParticipantDetail       = createLazyComponent('ParticipantDetail');
const BulkImportPage          = createLazyComponent('BulkImportPage');
const DocumentsList    = createLazyComponent('DocumentsList');
const ReportsList      = createLazyComponent('ReportsList');
const CalendarView     = createLazyComponent('CalendarView');
const Settings         = createLazyComponent('Settings');
const Locations        = createLazyComponent('Locations');
const Profile                = createLazyComponent('Profile');
const ProfileSettings        = createLazyComponent('ProfileSettings');
const SecuritySettings       = createLazyComponent('SecuritySettings');
const NotificationSettings   = createLazyComponent('NotificationSettings');
const PreferenceSettings     = createLazyComponent('PreferenceSettings');
const UserManagement    = createLazyComponent('UserManagement');
const RoleManagement    = createLazyComponent('RoleManagement');
const RoleMenuAssignment= createLazyComponent('RoleMenuAssignment');
const AuditLogs         = createLazyComponent('AuditLogs');
const NotFound  = createLazyComponent('NotFound');
const Forbidden = createLazyComponent('Forbidden');

// ==================== Animations & Loading Screen ====================
const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50%       { transform: scale(1.05); opacity: 0.8; }
`;
const fadeInOut = keyframes`
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
`;

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

const RecordingRouteWrapper = ({ children }) => (
  <MeetingRecorderProvider>
    {children}
  </MeetingRecorderProvider>
);

// ==================== Route Guards ====================
const ProtectedRoute = ({ children, requiredRoles = [], requiredPermissions = [], requireSuperuser = false }) => {
  const { isAuthenticated, isAuthChecking, user } = useSelector(selectAuth);
  const location = useLocation();

  useEffect(() => {
    if (user?.roles?.length > 0 || user?.is_superuser) {
      preloadRoleBasedComponents(user.roles, user.is_superuser);
    }
  }, [user]);

  if (isAuthChecking) {
    return <LoadingScreen message="Verifying access..." fullScreen={false} />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (requireSuperuser && !user?.is_superuser) {
    return <Navigate to="/forbidden" replace />;
  }
  if (requiredRoles.length > 0) {
    const userRoleCodes = (user?.roles || []).map(r => typeof r === 'object' ? r.code : r);
    const hasRole = requiredRoles.some(r => userRoleCodes.includes(r)) || user?.is_superuser;
    if (!hasRole) return <Navigate to="/forbidden" replace />;
  }
  if (requiredPermissions.length > 0) {
    const userPermissions = user?.permissions || [];
    const hasPermission = requiredPermissions.some(p => userPermissions.includes(p)) || user?.is_superuser;
    if (!hasPermission) return <Navigate to="/forbidden" replace />;
  }
  return children;
};

const MenuProtectedRoute = ({ children, menuCode }) => {
  const { user } = useSelector(selectAuth);
  const allowedMenuCodes = useSelector(selectAllowedMenuCodes);
  const menusLoading = useSelector(selectMenuLoading);

  if (!menuCode || user?.is_superuser) return children;
  if (menusLoading) {
    return <LoadingScreen message="Checking access..." fullScreen={false} />;
  }
  if (!allowedMenuCodes || typeof allowedMenuCodes.has !== 'function' || !allowedMenuCodes.has(menuCode)) {
    return <Navigate to="/forbidden" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isAuthChecking } = useSelector(selectAuth);
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  if (isAuthChecking) {
    return <LoadingScreen message="Checking session..." fullScreen={false} />;
  }
  return isAuthenticated ? <Navigate to={from} replace /> : children;
};

// ==================== Route Configuration Maps ====================
const routeConfig = {
  publicRoutes: [
    { path: '/login',                   element: <SignInSide />,     wrapper: PublicRoute },
    { path: '/signup',                  element: <SignUp />,         wrapper: PublicRoute },
    { path: '/forgot-password',         element: <ForgotPassword />, wrapper: PublicRoute },
    { path: '/reset-password/:token',   element: <ResetPassword />,  wrapper: PublicRoute },
  ],
  errorRoutes: [
    { path: '/403',        element: <Forbidden /> },
    { path: '/forbidden',  element: <Forbidden /> },
    { path: '/404',        element: <NotFound /> },
  ],
  recordingRoutes: [
    { path: 'meetings/:id/record', element: <MeetingRecorder /> },
  ],
  regularMeetingRoutes: [
    { path: 'meetings',                   element: <Meetings /> },
    { path: 'meetings/create',            element: <MeetingForm /> },
    { path: 'meetings/:id',               element: <MeetingDetail /> },
    { path: 'meetings/:id/edit',          element: <MeetingForm /> },
    { path: 'meetings/:id/notifications', element: <MeetingEmailNotifications /> },
  ],
  recurringMeetingRoutes: [
    { path: 'recurring-meetings',               element: <Meetings /> },
    { path: 'recurring-meetings/create',        element: <MeetingForm /> },
    { path: 'recurring-meetings/:id',           element: <RecurringMeetingDetail /> },
    { path: 'recurring-meetings/:id/edit',      element: <EditRecurringMeeting /> },
  ],
  protectedRoutes: [
    { path: 'dashboard',                          element: <Dashboard /> }, 
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
    { path: 'profile',                            element: <Profile /> }, 
    { path: 'profile/:tab',                       element: <Profile /> }, 
    { path: 'settings',                           element: <Settings /> }, 
    { path: 'settings/profile',                   element: <ProfileSettings /> }, 
    { path: 'settings/locations',                 element: <Locations />,      menuCode: 'locations' },
    { path: 'settings/security',                  element: <SecuritySettings /> }, 
    { path: 'settings/notifications',             element: <NotificationSettings /> }, 
    { path: 'settings/preferences',               element: <PreferenceSettings /> }, 
    { path: 'settings/status',                    element: <Settings /> },
    { path: 'settings/document-types',            element: <Settings /> },
    { path: 'settings/users',                     element: <UserManagement />,       menuCode: 'admin_users', superuserOnly: true },
    { path: 'settings/roles',                     element: <RoleManagement />,       menuCode: 'admin_roles' },
    { path: 'settings/audit',                     element: <AuditLogs />,            menuCode: 'admin_audit' },
    { path: 'settings/role-menu-assignment',      element: <RoleMenuAssignment />,   menuCode: 'admin_role_menu' },
    { path: 'settings/admin-structures/departments', element: <AdminStructures />,   menuCode: 'admin_structures' },
  ],
  adminRoutes: [
    { path: 'admin/users',  element: <UserManagement />, menuCode: 'admin_users' },
    { path: 'admin/roles',  element: <RoleManagement />, menuCode: 'admin_roles' },
    { path: 'admin/audit',  element: <AuditLogs />,      menuCode: 'admin_audit' },
  ],
};

const Lazy = ({ message = 'Loading page...', children }) => (
  <Suspense fallback={<LoadingScreen message={message} fullScreen={false} />}>
    {children}
  </Suspense>
);

const INIT_TIMEOUT_MS = 20000;
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

// Yields a tick so a setState right before this can actually paint before
// the next setState overwrites it. Without this, two setState calls that
// fire back-to-back with no `await` between them get batched into a single
// render and the intermediate value is never shown to the user.
const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

// ==================== AppContent Component ====================
const AppContent = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, isAuthChecking, user } = useSelector(selectAuth);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  // Hoisted to top level (was previously declared inside a conditional
  // branch further down, which violates the Rules of Hooks: hooks must run
  // in the same order on every render, and calling useState/useEffect only
  // when `isAuthChecking && !authCheckCompleted.current` is true meant the
  // hook list could shift between renders, corrupting React's internal
  // state/prop bookkeeping for this and any descendant component.
  const [forceProceed, setForceProceed] = useState(false);
  const initCalled = useRef(false);
  const authCheckCompleted = useRef(false);

  useEffect(() => {
    // NOTE: deliberately no local `isMounted` flag here. In React 18
    // StrictMode (dev only), effects run twice: mount -> cleanup -> mount.
    // `initCalled` (a ref, shared across both invocations) already
    // guarantees `initialize()` only truly runs once, so a per-closure
    // `isMounted` boolean flipped by the first invocation's cleanup would
    // do nothing except sabotage that one real run: every `if (isMounted)`
    // check after the first `await` would silently evaluate to false,
    // including the `finally` block's `setInitialized(true)` - which is
    // exactly what was freezing the loading screen at 30% forever. This
    // component is the app root and effectively never unmounts outside of
    // StrictMode's synthetic remount or a full page teardown, so skipping
    // the mounted-guard here is safe.
    const initialize = async () => {
      // Prevent multiple initialization attempts
      if (initCalled.current) return;
      initCalled.current = true;

      setLoadingProgress(30);
      await nextFrame();

      try {
        setLoadingProgress(60);

        // Only call checkAuth if not already authenticated
        if (!isAuthenticated && !authCheckCompleted.current) {
          try {
            await withTimeout(
              dispatch(checkAuth()).unwrap(),
              INIT_TIMEOUT_MS,
              'checkAuth()'
            );
            authCheckCompleted.current = true;
          } catch (authErr) {
            // Log but don't block - auth failures should redirect to login.
            // authErr is the rejectWithValue payload from checkAuth (e.g.
            // { reason: 'no_token' }), not a real Error, so there's no
            // `.message` in the common case - that's expected.
            console.warn('Auth check failed (non-fatal):', authErr?.reason || authErr?.message || authErr);
            authCheckCompleted.current = true;
          }
        } else {
          authCheckCompleted.current = true;
        }

        setLoadingProgress(80);
        // Preload critical components in the background
        preloadCriticalComponents().catch(err =>
          console.warn('Preload warning:', err)
        );
        // Give the 80% state a chance to paint before jumping to 100%.
        await nextFrame();
        setLoadingProgress(100);
      } catch (err) {
        const isTimeout = err?.code === 'ECONNABORTED' || /timed out/i.test(err?.message || '');

        if (err?.status === 0 || err?.code === 'ERR_NETWORK' || isTimeout) {
          console.error('Fatal initialization network failure:', err);
          setInitError('Unable to connect to the server. Please check your connection and try again.');
        } else if (err?.status === 500) {
          console.error('Fatal initialization server exception:', err);
          setInitError('Server error. Please try again later.');
        } else {
          console.warn('Caught initialization exception:', err?.message || err);
          // Non-fatal errors - proceed with app loading
          setLoadingProgress(100);
        }
      } finally {
        setInitialized(true);
        // Ensure auth check is marked complete
        authCheckCompleted.current = true;
      }
    };

    initialize();
  }, [dispatch, isAuthenticated]);

  // Force-proceed timer for a stuck auth check. Runs unconditionally (per
  // Rules of Hooks) but only arms its timeout when actually needed.
  useEffect(() => {
    if (!(isAuthChecking && !authCheckCompleted.current)) return;

    const timer = setTimeout(() => {
      setForceProceed(true);
      authCheckCompleted.current = true;
    }, 5000); // Force proceed after 5 seconds

    return () => clearTimeout(timer);
  }, [isAuthChecking]);

  // If there's a fatal initialization error, show the error screen
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

  // Only show loading screen if not initialized AND auth is still checking
  // OR if auth check is taking too long (timeout fallback)
  if (!initialized) {
    // If auth check is stuck for more than 10 seconds, force proceed
    // This is handled by the timeout in the init function
    return <LoadingScreen message="Starting Application..." progress={loadingProgress} />;
  }

  // If auth check is stuck, force proceed after a reasonable time
  // The loading screen will show briefly but then the app will render
  if (isAuthChecking && !authCheckCompleted.current && !forceProceed) {
    return <LoadingScreen message="Verifying access..." progress={null} />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen message="Loading application..." />}>
        <Routes>
          {routeConfig.publicRoutes.map(({ path, element, wrapper: Wrapper }) => (
            <Route key={path} path={path} element={<Wrapper>{element}</Wrapper>} />
          ))}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            {routeConfig.regularMeetingRoutes.map(({ path, element }) => (
              <Route key={path} path={path} element={<Lazy message="Loading meeting page...">{element}</Lazy>} />
            ))}
            {routeConfig.recurringMeetingRoutes.map(({ path, element }) => (
              <Route key={path} path={path} element={<Lazy message="Loading recurring meeting page...">{element}</Lazy>} />
            ))}
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
            {routeConfig.protectedRoutes.map(({ path, element, menuCode, roles, superuserOnly }) => {
              const gated = (
                <MenuProtectedRoute menuCode={menuCode}>
                  <Lazy>{element}</Lazy>
                </MenuProtectedRoute>
              );
              const needsHardGate = superuserOnly || (roles && roles.length > 0);
              return (
                <Route
                  key={path}
                  path={path}
                  element={
                    needsHardGate
                      ? (
                        <ProtectedRoute requiredRoles={roles || []} requireSuperuser={!!superuserOnly}>
                          {gated}
                        </ProtectedRoute>
                      )
                      : gated
                  }
                />
              );
            })}
            {routeConfig.adminRoutes.map(({ path, element, menuCode }) => (
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
          </Route>
          {routeConfig.errorRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={<Lazy message="Loading...">{element}</Lazy>} />
          ))}
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

// ==================== Main App Entry Component ====================
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