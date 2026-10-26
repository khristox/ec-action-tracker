import apiClient, { isOptionalEndpoint } from '../store/api/apiClient';
export { logout, tokenStorage, isOptionalEndpoint } from '../store/api/apiClient';

const api = apiClient; // lets the code below stay unchanged

export const organizationAPI = {
  /**
   * Get the complete organization tree.
   * GET /api/v1/organization/tree
   */
  getTree: async (rootId = null) => {
    const params = rootId ? { root_id: rootId } : undefined;

    const response = await apiClient.get('/organization/tree', {
      params,
    });

    return response.data;
  },

  /**
   * Get all organization nodes.
   * GET /api/v1/organization/
   */
  getAll: async (params = {}) => {
    const response = await apiClient.get('/organization/', {
      params,
    });

    return response.data;
  },

  /**
   * Create an organization node.
   * POST /api/v1/organization/nodes
   */
  create: async (data) => {
    const response = await apiClient.post('/organization/nodes', data);

    return response.data;
  },

  /**
   * Update an organization node.
   * PUT /api/v1/organization/nodes/{id}
   */
  update: async (id, data) => {
    const response = await apiClient.put(`/organization/nodes/${id}`, data);

    return response.data;
  },

  /**
   * Delete an organization node.
   * Defaults to soft delete because the backend defaults
   * soft_delete=True.
   */
  delete: async (id, softDelete = true) => {
    const response = await apiClient.delete(`/organization/nodes/${id}`, {
      params: {
        soft_delete: softDelete,
      },
    });

    return response.data;
  },

  /**
   * Move an organization node to a new parent.
   * PATCH /api/v1/organization/nodes/{id}/move
   *
   * The backend expects new_parent_id and new_order
   * as query parameters.
   */
  move: async (sourceNodeId, targetNodeId, newOrder = null) => {
    const params = {
      new_parent_id: targetNodeId,
    };

    if (newOrder !== null && newOrder !== undefined) {
      params.new_order = newOrder;
    }

    const response = await apiClient.patch(
      `/organization/nodes/${sourceNodeId}/move`,
      null,
      { params }
    );

    return response.data;
  },
};
export const isEndpointAvailable = async (url) => { /* ...unchanged... */ };
export const fetchWithFallback = async (url, fallbackData = { items: [], total: 0 }) => { /* ...unchanged... */ };

export default apiClient;