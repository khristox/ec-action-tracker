// src/services/meetingsAPI.js

import api from './api';
import { requestDeduplicator } from '../utils/requestDeduplicator';

// Cache times in milliseconds
const CACHE_TIMES = {
  LIST: 30000,
  DETAIL: 60000,
  STATS: 120000,
  PARTICIPANTS: 30000,
  MINUTES: 30000,
  ACTIONS: 30000,
};

export const meetingsAPI = {
  getAll: (params = {}) => {
    const key = `meetings_list_${JSON.stringify(params)}`;
    return requestDeduplicator.deduplicate(
      key,
      () => api.get('/action-tracker/meetings/', { params }),
      { cacheTime: CACHE_TIMES.LIST }
    );
  },

  getStats: (params = {}) => {
    const key = `meetings_stats_${JSON.stringify(params)}`;
    return requestDeduplicator.deduplicate(
      key,
      () => api.get('/action-tracker/meetings/stats', { params }),
      { cacheTime: CACHE_TIMES.STATS }
    );
  },

  getById: (id) => {
    const key = `meeting_detail_${id}`;
    return requestDeduplicator.deduplicate(
      key,
      () => api.get(`/action-tracker/meetings/${id}`),
      { cacheTime: CACHE_TIMES.DETAIL }
    );
  },

  getMinutes: (meetingId, params = {}) => {
    const key = `meeting_minutes_${meetingId}_${JSON.stringify(params)}`;
    return requestDeduplicator.deduplicate(
      key,
      () => api.get(`/action-tracker/meetings/${meetingId}/minutes`, { params }),
      { cacheTime: CACHE_TIMES.MINUTES }
    );
  },

  getMyTasks: (params = {}) => {
    const key = `my_tasks_${JSON.stringify(params)}`;
    return requestDeduplicator.deduplicate(
      key,
      () => api.get('/action-tracker/actions/my-tasks', { params }),
      { cacheTime: CACHE_TIMES.ACTIONS }
    );
  },

  getParticipants: (meetingId, params = {}) => {
    const key = `meeting_participants_${meetingId}_${JSON.stringify(params)}`;
    return requestDeduplicator.deduplicate(
      key,
      () => api.get(`/action-tracker/meetings/${meetingId}/participants`, { params }),
      { cacheTime: CACHE_TIMES.PARTICIPANTS }
    );
  },

  getDocuments: (meetingId, params = {}) => {
    const key = `meeting_documents_${meetingId}_${JSON.stringify(params)}`;
    return requestDeduplicator.deduplicate(
      key,
      () => api.get(`/action-tracker/meetings/${meetingId}/documents`, { params }),
      { cacheTime: CACHE_TIMES.PARTICIPANTS }
    );
  },

  getActions: (meetingId, params = {}) => {
    // NOTE: there is no /action-tracker/meetings/{id}/actions route in the
    // spec at all. Actions are fetched per-minute
    // (/action-tracker/minutes/{minute_id}/actions), not per-meeting. If
    // you need "all actions for a meeting", you'll need to fetch the
    // meeting's minutes first, then fetch actions for each minute - there's
    // no single endpoint for this. Flagging rather than guessing a path.
    const key = `meeting_actions_${meetingId}_${JSON.stringify(params)}`;
    return requestDeduplicator.deduplicate(
      key,
      () => api.get(`/action-tracker/meetings/${meetingId}/actions`, { params }),
      { cacheTime: CACHE_TIMES.ACTIONS }
    );
  },

  getRecurring: (params = {}) => {
    const key = `recurring_meetings_${JSON.stringify(params)}`;
    return requestDeduplicator.deduplicate(
      key,
      () => api.get('/recurring-meetings/', { params }),
      { cacheTime: CACHE_TIMES.LIST }
    );
  },

  clearCache: () => {
    requestDeduplicator.clear();
  },

  clearByPrefix: (prefix) => {
    requestDeduplicator.clearByPrefix(prefix);
  },
};

export default meetingsAPI;