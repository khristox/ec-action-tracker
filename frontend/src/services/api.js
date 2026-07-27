// src/services/api.js

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';

// ✅ Refresh token state management
let isRefreshing = false;
let refreshSubscribers = [];
let refreshPromise = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track pending requests to prevent duplicates
const pendingRequests = new Map();

// List of optional endpoints that should return empty data instead of errors
const OPTIONAL_ENDPOINTS = [
  'participants',
  'my-tasks',
  'recurring-meetings',
  'attributes',
  'stats',
  'filter-options',
];

// Check if a URL is for an optional endpoint
const isOptionalEndpoint = (url) => {
  if (!url) return false;
  return OPTIONAL_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

// Check if a URL is public (no auth required)
const isPublicEndpoint = (url) => {
  if (!url) return false;
  const publicEndpoints = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];
  return publicEndpoints.some(endpoint => url.includes(endpoint));
};

// ✅ Helper to process queued requests
const processQueue = (error, token = null) => {
  refreshSubscribers.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  refreshSubscribers = [];
};

// Request interceptor with deduplication and timeout
api.interceptors.request.use(
  (config) => {
    // Skip for public endpoints
    if (isPublicEndpoint(config.url)) {
      return config;
    }

    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    
    // Only log in development to reduce noise
    if (process.env.NODE_ENV === 'development') {
      console.log('API Request:', {
        url: config.url,
        method: config.method,
        hasToken: !!token,
        timestamp: new Date().toISOString()
      });
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with token refresh, timeout handling, and graceful 404s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Prevent infinite retry loops
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    // ✅ GRACEFUL 404 HANDLING FOR OPTIONAL ENDPOINTS
    if (error.response?.status === 404) {
      const url = originalRequest?.url || '';
      
      // Check if this is an optional endpoint
      if (isOptionalEndpoint(url)) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Optional endpoint returned 404: ${url}. Returning empty data.`);
        }
        
        // Return successful response with empty data
        return Promise.resolve({
          data: { 
            items: [], 
            total: 0,
            data: [],
            results: [],
            count: 0,
            message: 'Endpoint not available'
          },
          status: 200,
          statusText: 'OK (Mocked - Endpoint not implemented)',
          config: originalRequest,
          headers: {},
        });
      }
    }

    // Check if it's a timeout error
    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    
    // Log error with detail (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(error)
      console.error('API Error:', {
        status: error.response?.status,
        url: error.config?.url,
        message: error.response?.data?.detail || error.message,
        timeout: isTimeout,
        method: error.config?.method,
      });
    }

    // ✅ IMPROVED: Handle 401 Unauthorized with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      // ✅ Check if it's a refresh token request itself - prevent loops
      if (originalRequest.url?.includes('/auth/refresh')) {
        // Refresh token itself failed - clear tokens and redirect
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/signup') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // ✅ If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshSubscribers.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // ✅ Create a single refresh promise
        if (!refreshPromise) {
          refreshPromise = axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { refresh_token: refreshToken },
            { timeout: 10000 }
          );
        }

        const response = await refreshPromise;
        
        const newAccessToken = response.data.access_token;
        const newRefreshToken = response.data.refresh_token;

        if (newAccessToken) {
          // ✅ Store both tokens
          localStorage.setItem('access_token', newAccessToken);
          localStorage.setItem('token', newAccessToken);
          
          if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken);
          }

          // ✅ Update default header
          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

          // ✅ Process queued requests
          processQueue(null, newAccessToken);

          // ✅ Retry the original request
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } else {
          throw new Error('Invalid refresh response - no access token');
        }

      } catch (refreshError) {
        // ✅ Clear tokens and process queue with error
        processQueue(refreshError, null);
        
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        // ✅ Redirect to login
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/signup') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    }

    // Handle timeout specifically - return a user-friendly error
    if (isTimeout) {
      return Promise.reject({
        ...error,
        message: 'The server is taking too long to respond. Please try again.',
        isTimeout: true,
      });
    }

    return Promise.reject(error);
  }
);

// ✅ Export organizationAPI as before
export const organizationAPI = {
  getAll: async () => {
    const response = await api.get('/organization/nodes');
    return response.data;
  },
  getTree: async () => {
    const response = await api.get('/organization/tree');
    return response.data;
  },
  get: async (id) => {
    const response = await api.get(`/organization/nodes/${id}`);
    return response.data;
  },
  create: async (data) => {
    const cleanData = {
      ...data,
      parent_id: data.parent_id === '' || data.parent_id === undefined ? null : data.parent_id,
      employee_count: Number(data.employee_count) || 0,
      budget: Number(data.budget) || 0,
      order: Number(data.order) || 0
    };
    const response = await api.post('/organization/nodes', cleanData);
    return response.data;
  },
  update: async (id, data) => {
    const cleanData = {
      ...data,
      parent_id: data.parent_id === '' || data.parent_id === undefined ? null : data.parent_id
    };
    const response = await api.put(`/organization/nodes/${id}`, cleanData);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/organization/nodes/${id}`);
    return response.data;
  },
  move: async (id, newParentId) => {
    const response = await api.patch(`/organization/nodes/${id}/move`, {
      new_parent_id: newParentId === '' || newParentId === undefined ? null : newParentId
    });
    return response.data;
  }
};

// ✅ Helper to check if an endpoint is available (useful for components)
export const isEndpointAvailable = async (url) => {
  try {
    const response = await api.head(url);
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

// ✅ Helper to get data with fallback
export const fetchWithFallback = async (url, fallbackData = { items: [], total: 0 }) => {
  try {
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    // If it's a 404 or optional endpoint, return fallback
    if (error.response?.status === 404 || isOptionalEndpoint(url)) {
      return fallbackData;
    }
    throw error;
  }
};

// ✅ Helper to manually clear tokens and logout
export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  
  // Reset headers
  delete api.defaults.headers.common['Authorization'];
  
  // Redirect to login
  window.location.href = '/login';
};

export default api;