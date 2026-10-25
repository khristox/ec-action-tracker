import apiClient, { isOptionalEndpoint } from '../store/api/apiClient';
export { logout, tokenStorage, isOptionalEndpoint } from '../store/api/apiClient';

const api = apiClient; // lets the code below stay unchanged

export const organizationAPI = { /* ...unchanged... */ };
export const isEndpointAvailable = async (url) => { /* ...unchanged... */ };
export const fetchWithFallback = async (url, fallbackData = { items: [], total: 0 }) => { /* ...unchanged... */ };

export default apiClient;