// src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Try both possible token keys (your auth slice uses 'access_token')
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      hasToken: !!token
    });
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      message: error.response?.data?.detail
    });
    
    // Only redirect if it's a 401 and we're not already on login page
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/signup') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);


// src/services/api.js - Ensure UUIDs are handled as strings

export const organizationAPI = {
  // Get all nodes
  getAll: async () => {
    const response = await api.get('/organization/nodes');
    return response.data;
  },
  
  // Get tree structure
  getTree: async () => {
    const response = await api.get('/organization/tree');
    return response.data;
  },
  
  // Get single node
  get: async (id) => {
    // id is string UUID, don't convert
    const response = await api.get(`/organization/nodes/${id}`);
    return response.data;
  },
  
  // Create node
  create: async (data) => {
    // Make sure parent_id is null or string, not number
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
  
  // Update node
  update: async (id, data) => {
    const cleanData = {
      ...data,
      parent_id: data.parent_id === '' || data.parent_id === undefined ? null : data.parent_id
    };
    const response = await api.put(`/organization/nodes/${id}`, cleanData);
    return response.data;
  },
  
  // Delete node
  delete: async (id) => {
    const response = await api.delete(`/organization/nodes/${id}`);
    return response.data;
  },
  
  // Move node
  move: async (id, newParentId) => {
    const response = await api.patch(`/organization/nodes/${id}/move`, {
      new_parent_id: newParentId === '' || newParentId === undefined ? null : newParentId
    });
    return response.data;
  }
};


export default api;