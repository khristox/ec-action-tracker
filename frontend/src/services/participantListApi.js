import api from './api';

export const participantListApi = {
  // Lists
  getLists: (params = {}) => api.get('/action-tracker/participant-lists', { params }),
  getList: (id) => api.get(`/action-tracker/participant-lists/${id}`),
  createList: (data) => api.post('/action-tracker/participant-lists', data),
  updateList: (id, data) => api.put(`/action-tracker/participant-lists/${id}`, data),
  deleteList: (id) => api.delete(`/action-tracker/participant-lists/${id}`),
  
  // Members
  getListMembers: (listId, params) => api.get(`/action-tracker/participant-lists/${listId}/members`, { params }),
  addMembers: (listId, participantIds) => api.post(`/action-tracker/participant-lists/${listId}/members`, { participant_ids: participantIds }),
  removeMember: (listId, participantId) => api.delete(`/action-tracker/participant-lists/${listId}/members/${participantId}`),
  getAvailableParticipants: (listId, params) => api.get(`/action-tracker/participant-lists/${listId}/available-participants`, { params }),
};