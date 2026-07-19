// src/utils/requestDeduplicator.js

/**
 * Request Deduplicator - Prevents duplicate concurrent API requests
 */
class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
    this.cache = new Map();
    this.debug = process.env.NODE_ENV === 'development';
  }

  /**
   * Deduplicate concurrent requests with the same key
   */
  async deduplicate(requestKey, requestFn, options = {}) {
    const { cacheTime = 0, forceRefresh = false } = options;

    // Check cache first
    if (!forceRefresh && cacheTime > 0) {
      const cached = this._getCached(requestKey);
      if (cached) {
        if (this.debug) {
          console.log(`📦 Cache hit for: ${requestKey}`);
        }
        return cached;
      }
    }

    // Check if there's a pending request with this key
    if (this.pendingRequests.has(requestKey)) {
      if (this.debug) {
        console.log(`🔄 Deduplicating request: ${requestKey}`);
      }
      return this.pendingRequests.get(requestKey);
    }

    // Create the request promise
    if (this.debug) {
      console.log(`🚀 Starting new request: ${requestKey}`);
    }

    const promise = requestFn()
      .then(result => {
        this.pendingRequests.delete(requestKey);
        if (cacheTime > 0) {
          this._setCache(requestKey, result, cacheTime);
        }
        if (this.debug) {
          console.log(`✅ Request completed: ${requestKey}`);
        }
        return result;
      })
      .catch(error => {
        this.pendingRequests.delete(requestKey);
        if (this.debug) {
          console.error(`❌ Request failed: ${requestKey}`, error);
        }
        throw error;
      });

    this.pendingRequests.set(requestKey, promise);
    return promise;
  }

  _getCached(key) {
    const cache = this.cache.get(key);
    if (!cache) return null;
    const elapsed = Date.now() - cache.timestamp;
    if (elapsed > cache.ttl) {
      this.cache.delete(key);
      return null;
    }
    return cache.data;
  }

  _setCache(key, data, ttl) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now(),
      ttl: ttl,
    });
  }

  clear() {
    this.pendingRequests.clear();
    this.cache.clear();
    if (this.debug) {
      console.log('🗑️ Request deduplicator cleared');
    }
  }

  clearKey(key) {
    this.pendingRequests.delete(key);
    this.cache.delete(key);
    if (this.debug) {
      console.log(`🗑️ Key cleared: ${key}`);
    }
  }

  clearByPrefix(prefix) {
    const keysToRemove = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.cache.delete(key);
    }
    for (const key of this.pendingRequests.keys()) {
      if (key.startsWith(prefix)) {
        this.pendingRequests.delete(key);
      }
    }
    if (this.debug) {
      console.log(`🗑️ Cleared ${keysToRemove.length} keys with prefix: ${prefix}`);
    }
  }

  getStatus() {
    return {
      pendingRequests: this.pendingRequests.size,
      cachedItems: this.cache.size,
      pendingKeys: Array.from(this.pendingRequests.keys()),
      cacheKeys: Array.from(this.cache.keys()),
    };
  }
}

export const requestDeduplicator = new RequestDeduplicator();
export default requestDeduplicator;