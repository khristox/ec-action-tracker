import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// apiClient.js - Add response interceptor to suppress 404 for profile picture
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Suppress 404 errors for profile picture endpoint
    if (error.config?.url?.includes('/profile-picture/base64') && error.response?.status === 404) {
      // Return a mock successful response
      return Promise.resolve({ 
        data: { has_picture: false, profile_picture: null },
        status: 200,
        config: error.config,
        headers: {}
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;