// src/utils/requestUtils.js

import { requestTracker } from './requestTracker';
import api from '../services/api';

/**
 * Generate a unique key for a request
 * @param {string} url - API endpoint
 * @param {object} params - Request parameters
 * @param {string} method - HTTP method (default: 'get')
 * @returns {string} - Unique key
 */
const generateRequestKey = (url, params = {}, method = 'get') => {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  
  const paramsString = Object.keys(sortedParams).length > 0 
    ? `_${JSON.stringify(sortedParams)}` 
    : '';
  
  return `${method}_${url}${paramsString}`;
};

/**
 * Make a deduplicated API request
 * @param {string} url - API endpoint
 * @param {object} config - Axios config
 * @param {object} options - Options
 * @param {string} options.key - Custom key (optional)
 * @param {boolean} options.forceRefresh - Force refresh (skip cache)
 * @returns {Promise} - API response
 */
export const deduplicatedRequest = async (url, config = {}, options = {}) => {
  const { key, forceRefresh = false, signal: externalSignal } = options;
  const method = config.method || 'get';
  
  // Generate a unique key for this request
  const requestKey = key || generateRequestKey(url, config.params, method);
  
  // If forceRefresh is true, cancel any existing request
  if (forceRefresh && requestTracker.isPending(requestKey)) {
    requestTracker.cancel(requestKey);
  }
  
  // Check if request is already in progress and return its active promise
  if (requestTracker.isPending(requestKey)) {
    return requestTracker.pendingRequests.get(requestKey);
  }
  
  // Create abort controller for this request
  const controller = new AbortController();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort());
  }
  config.signal = controller.signal;
  
  // Create the request promise with guaranteed cleanup in .finally()
  const promise = api(url, config)
    .then(response => response)
    .catch(error => {
      // Intercept and resolve cancellation silently to prevent global error logging
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED' || error.message === 'canceled') {
        return { data: {}, canceled: true };
      }
      throw error;
    })
    .finally(() => {
      // Ensure tracker cache is cleared no matter how the promise settles
      requestTracker.complete(requestKey);
    });
  
  // Start tracking and return the promise
  return requestTracker.start(requestKey, promise, controller);
};

/**
 * Deduplicated GET request
 */
export const deduplicatedGet = (url, params = {}, options = {}) => {
  return deduplicatedRequest(url, { method: 'get', params }, options);
};

/**
 * Deduplicated POST request
 */
export const deduplicatedPost = (url, data = {}, options = {}) => {
  return deduplicatedRequest(url, { method: 'post', data }, options);
};

/**
 * Deduplicated PUT request
 */
export const deduplicatedPut = (url, data = {}, options = {}) => {
  return deduplicatedRequest(url, { method: 'put', data }, options);
};

/**
 * Deduplicated DELETE request
 */
export const deduplicatedDelete = (url, options = {}) => {
  return deduplicatedRequest(url, { method: 'delete' }, options);
};