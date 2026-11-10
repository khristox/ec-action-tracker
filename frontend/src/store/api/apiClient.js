import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api/v1' : 'http://localhost:8001/api/v1');
const BASE = import.meta.env.BASE_URL; // '/ec/'

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const LEGACY_KEY = 'token';
const USER_KEY = 'user';

// No Authorization header, and a 401 here is never "expired token"
const NO_AUTH_URLS = /\/auth\/(login|signup|register|refresh|logout|forgot-password|reset-password)/;

const OPTIONAL_ENDPOINTS = [
  'participants', 'my-tasks', 'recurring-meetings', 'attributes', 'stats', 'filter-options',
];
export const isOptionalEndpoint = (url) =>
  !!url && OPTIONAL_ENDPOINTS.some((e) => url.includes(e));

// A web page where JSON should be: firewall/WAF block page, proxy error page,
// or the SPA index.html returned by a wrong API URL.
const looksLikeHtml = (d) =>
  typeof d === 'string' && /^\s*<\s*(!doctype\s+html|html)/i.test(d);

const nonApiError = (res) => {
  const caseNo = /_event_transid\s*=\s*'(\d+)'/.exec(res.data)?.[1];
  const err = new Error(
    'The server returned a web page instead of data. A firewall, proxy, or wrong API URL is the likely cause' +
      (caseNo ? ` (security case ${caseNo})` : '') +
      '. Contact your IT administrator if this persists.'
  );
  err.isBlocked = true;
  err.response = res;
  err.config = res.config;
  return err;
};

let authFailed = false;     // latch: many failing requests -> one logout/redirect
let refreshPromise = null;  // single-flight refresh
let onAuthFailure = null;   // injected by the app (avoids circular import with the store)

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY) || localStorage.getItem(LEGACY_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: ({ access_token, refresh_token }) => {
    if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
    localStorage.removeItem(LEGACY_KEY);
    authFailed = false;
  },
  clear: () => {
    [ACCESS_KEY, REFRESH_KEY, LEGACY_KEY, USER_KEY].forEach((k) => localStorage.removeItem(k));
  },
};

export const setAuthFailureHandler = (fn) => {
  onAuthFailure = fn;
};

const redirectToLogin = () => {
  const loginPath = `${BASE}login`;
  const { pathname } = window.location;
  if (pathname.startsWith(loginPath) || pathname.startsWith(`${BASE}signup`)) return;
  window.location.assign(loginPath);
};

const handleAuthFailure = () => {
  if (authFailed) return;
  authFailed = true;
  tokenStorage.clear();
  if (onAuthFailure) onAuthFailure();
  else redirectToLogin();
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // override per request for big uploads: { timeout: 120000 }
  headers: { 'Content-Type': 'application/json' },
});

// Bare instance: no interceptors, so a failing refresh can't recurse
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Manual logout: best-effort server-side revoke (needs POST /auth/logout; harmless if missing),
// then clear local state immediately without waiting for the network.
export const logout = () => {
  const refresh = tokenStorage.getRefresh();
  if (refresh) {
    refreshClient.post('/auth/logout', { refresh_token: refresh }).catch(() => {});
  }
  authFailed = false;
  handleAuthFailure();
};

const refreshAccessToken = () => {
  if (!refreshPromise) {
    const refreshToken = tokenStorage.getRefresh();
    if (!refreshToken) return Promise.reject(new Error('No refresh token available'));

    refreshPromise = refreshClient
      .post('/auth/refresh', { refresh_token: refreshToken })
      .then(({ data }) => {
        if (!data?.access_token) throw new Error('Invalid refresh response - no access token');
        tokenStorage.set(data);
        return data.access_token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Request: attach token (skip public endpoints)
apiClient.interceptors.request.use(
  (config) => {
    if (!NO_AUTH_URLS.test(config.url || '')) {
      const token = tokenStorage.getAccess();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response
apiClient.interceptors.response.use(
  (response) => {
    // 2xx that is really a block/error page, never treat it as data
    if (response.config?.responseType !== 'blob' && looksLikeHtml(response.data)) {
      return Promise.reject(nonApiError(response));
    }
    return response;
  },
  async (error) => {
    const { config, response } = error;
    const url = config?.url || '';

    // HTML on an error status (WAF 403, proxy 502, ...): surface it. This runs before
    // the 404 fallback and the 401 refresh logic so neither can mask or loop on it.
    if (response && looksLikeHtml(response.data)) {
      return Promise.reject(nonApiError(response));
    }

    // Profile picture 404 -> "no picture"
    if (url.includes('/profile-picture/base64') && response?.status === 404) {
      return { data: { has_picture: false, profile_picture: null }, status: 200, config, headers: {} };
    }

    // Optional endpoints 404 -> empty data (opt out with { skipOptionalFallback: true })
    if (response?.status === 404 && !config?.skipOptionalFallback && isOptionalEndpoint(url)) {
      console.warn(`Optional endpoint 404, returning empty data: ${url}`);
      return {
        data: { items: [], total: 0, data: [], results: [], count: 0, message: 'Endpoint not available' },
        status: 200,
        statusText: 'OK (Mocked - Endpoint not implemented)',
        config,
        headers: {},
      };
    }

    if (import.meta.env.DEV) {
      console.error('API Error:', {
        status: response?.status,
        url,
        method: config?.method,
        message: response?.data?.detail || error.message,
      });
    }

    // 401 -> refresh once, retry once
    if (response?.status === 401 && config && !config._retry && !NO_AUTH_URLS.test(url)) {
      config._retry = true;

      let newToken;
      try {
        const current = tokenStorage.getAccess();
        // Someone else already refreshed while this request was in flight
        if (current && config.headers.Authorization !== `Bearer ${current}`) {
          newToken = current;
        } else {
          newToken = await refreshAccessToken();
        }
      } catch (e) {
        // Only a definite "token rejected" ends the session; network blips,
        // timeouts, and blocked responses must not log people out.
        const status = e?.response?.status;
        const rejected =
          status === 400 || status === 401 || status === 403 ||
          e?.message === 'No refresh token available';
        if (rejected) handleAuthFailure();
        return Promise.reject(error);
      }

      config.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(config); // outside try: retry failures aren't "refresh failures"
    }

    // Timeout -> friendly message, keep the original Error object
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.message = 'The server is taking too long to respond. Please try again.';
      error.isTimeout = true;
    }

    return Promise.reject(error);
  }
);

export default apiClient;