// src/components/actiontracker/meetings/hooks/useTabPersistence.js
import { useState, useEffect, useCallback } from 'react';

export const useTabPersistence = (key, defaultValue = 0) => {
  const [tabValue, setTabValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? parseInt(saved) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  });

  const setTab = useCallback((value) => {
    setTabValue(value);
    try {
      localStorage.setItem(key, value.toString());
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }, [key]);

  return [tabValue, setTab];
};

export const usePreferencePersistence = (key, defaultValue) => {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null && typeof defaultValue === 'boolean') {
        return saved === 'true';
      }
      return saved !== null ? saved : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  });

  const setPreference = useCallback((newValue) => {
    setValue(newValue);
    try {
      localStorage.setItem(key, newValue.toString());
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }, [key]);

  return [value, setPreference];
};