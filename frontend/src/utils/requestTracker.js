// src/utils/requestTracker.js

/**
 * Global request tracker to prevent duplicate API calls
 * Works across all components and thunks
 */
class RequestTracker {
  constructor() {
    // Map to store pending requests
    // Key: string (request identifier), Value: Promise or boolean
    this.pendingRequests = new Map();
    
    // Map to store abort controllers
    this.abortControllers = new Map();
  }

  /**
   * Check if a request is already in progress
   * @param {string} key - Unique identifier for the request
   * @returns {boolean} - True if request is already pending
   */
  isPending(key) {
    return this.pendingRequests.has(key);
  }

  /**
   * Start tracking a request
   * @param {string} key - Unique identifier for the request
   * @param {Promise} promise - The request promise
   * @param {AbortController} controller - Optional abort controller
   * @returns {Promise} - The original promise or the existing one
   */
  start(key, promise, controller = null) {
    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {
      console.log(`🔄 Request already in progress: ${key}`);
      return this.pendingRequests.get(key);
    }

    // Store the abort controller if provided
    if (controller) {
      this.abortControllers.set(key, controller);
    }

    // Store the promise
    this.pendingRequests.set(key, promise);

    // Return the promise
    return promise;
  }

  /**
   * Mark a request as completed
   * @param {string} key - Unique identifier for the request
   */
  complete(key) {
    this.pendingRequests.delete(key);
    this.abortControllers.delete(key);
  }

  /**
   * Cancel a specific pending request
   * @param {string} key - Unique identifier for the request
   */
  cancel(key) {
    if (this.abortControllers.has(key)) {
      this.abortControllers.get(key).abort();
      this.abortControllers.delete(key);
    }
    this.pendingRequests.delete(key);
  }

  /**
   * Cancel all pending requests (useful on logout)
   */
  cancelAll() {
    for (const [key, controller] of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get the number of pending requests
   */
  get pendingCount() {
    return this.pendingRequests.size;
  }

  /**
   * Get all pending request keys
   */
  get pendingKeys() {
    return Array.from(this.pendingRequests.keys());
  }
}

// Export a singleton instance
export const requestTracker = new RequestTracker();

// Also export a hook for use in components (optional)
export const useRequestTracker = () => requestTracker;