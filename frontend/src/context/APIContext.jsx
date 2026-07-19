// src/context/APIContext.jsx

import React, { createContext, useContext, useRef, useCallback } from 'react';
import { requestDeduplicator } from '../utils/requestDeduplicator';

const APIContext = createContext(null);

export const APIProvider = ({ children }) => {
  const pendingRequestsRef = useRef(new Map());

  const deduplicate = useCallback(async (key, requestFn, options = {}) => {
    return requestDeduplicator.deduplicate(key, requestFn, options);
  }, []);

  const clearCache = useCallback(() => {
    requestDeduplicator.clear();
  }, []);

  const clearKey = useCallback((key) => {
    requestDeduplicator.clearKey(key);
  }, []);

  return (
    <APIContext.Provider
      value={{
        deduplicate,
        clearCache,
        clearKey,
      }}
    >
      {children}
    </APIContext.Provider>
  );
};

export const useAPI = () => {
  const context = useContext(APIContext);
  if (!context) {
    throw new Error('useAPI must be used within an APIProvider');
  }
  return context;
};