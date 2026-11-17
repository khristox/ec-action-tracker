import apiClient from '../store/api/apiClient';
export { logout, tokenStorage, isOptionalEndpoint } from '../store/api/apiClient';

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

export const organizationAPI = {
  /** GET /api/v1/organization/tree */
  getTree: async (rootId = null) => {
    const params = rootId ? { root_id: rootId } : undefined;
    const response = await apiClient.get('/organization/tree', { params });
    return response.data;
  },

  /** GET /api/v1/organization/ */
  getAll: async (params = {}) => {
    const response = await apiClient.get('/organization/', { params });
    return response.data;
  },

  /** GET /api/v1/organization/nodes/{id}  (from the old branch) */
  get: async (id) => {
    const response = await apiClient.get(`/organization/nodes/${id}`);
    return response.data;
  },

  /** POST /api/v1/organization/nodes */
  create: async (data) => {
    const payload = {
      ...data,
      parent_id: emptyToNull(data.parent_id),
      employee_count: Number(data.employee_count) || 0,
      budget: Number(data.budget) || 0,
      order: Number(data.order) || 0,
    };
    const response = await apiClient.post('/organization/nodes', payload);
    return response.data;
  },

  /** PUT /api/v1/organization/nodes/{id} */
  update: async (id, data) => {
    const payload = { ...data, parent_id: emptyToNull(data.parent_id) };
    const response = await apiClient.put(`/organization/nodes/${id}`, payload);
    return response.data;
  },

  /** DELETE /api/v1/organization/nodes/{id}  (soft delete by default) */
  delete: async (id, softDelete = true) => {
    const response = await apiClient.delete(`/organization/nodes/${id}`, {
      params: { soft_delete: softDelete },
    });
    return response.data;
  },

  /** PATCH /api/v1/organization/nodes/{id}/move  (new_parent_id / new_order as query params) */
  move: async (sourceNodeId, targetNodeId, newOrder = null) => {
    const params = { new_parent_id: targetNodeId };
    if (newOrder !== null && newOrder !== undefined) params.new_order = newOrder;
    const response = await apiClient.patch(`/organization/nodes/${sourceNodeId}/move`, null, { params });
    return response.data;
  },
};

// True only if the route exists and answers; 404 or no response means "not available".
export const isEndpointAvailable = async (url) => {
  try {
    await apiClient.get(url, { params: { limit: 1 } });
    return true;
  } catch (error) {
    return !!error.response && error.response.status !== 404 && !error.isBlocked;
  }
};

// Falls back ONLY on a real 404. Everything else (401, 403, 500, timeouts,
// blocked pages) is rethrown so the UI can show the real problem.
export const fetchWithFallback = async (url, fallbackData = { items: [], total: 0 }) => {
  try {
    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404 && !error.isBlocked) return fallbackData;
    throw error;
  }
};

export default apiClient;