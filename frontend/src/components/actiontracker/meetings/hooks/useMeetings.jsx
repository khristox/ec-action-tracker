// src/components/actiontracker/meetings/hooks/useMeetings.jsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchMeetings,
  selectAllMeetings,
  selectMeetingsLoading,
  selectMeetingError,
  selectMeetingPagination
} from '../../../../store/slices/actionTracker/meetingSlice';
import api from '../../../../services/api';

export const useMeetings = () => {
  const dispatch = useDispatch();
  const meetings = useSelector(selectAllMeetings);
  const loading = useSelector(selectMeetingsLoading);
  const error = useSelector(selectMeetingError);
  const pagination = useSelector(selectMeetingPagination);
  
  const [recurringMeetings, setRecurringMeetings] = useState([]);
  const [loadingRecurring, setLoadingRecurring] = useState(false);
  const [recurringError, setRecurringError] = useState(null);
  
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadMeetings = useCallback(async (params) => {
    try {
      await dispatch(fetchMeetings(params)).unwrap();
      return true;
    } catch (err) {
      console.error('Failed to load meetings:', err);
      return false;
    }
  }, [dispatch]);

  const loadRecurringMeetings = useCallback(async () => {
    setLoadingRecurring(true);
    setRecurringError(null);
    try {
      // IMPORTANT: Add trailing slash to match the backend route
      const response = await api.get('/recurring-meetings/', {
        params: { 
          limit: 100,
          skip: 0
        }
      });
      
      
      // Extract the data array from the wrapped response
      let meetingsArray = [];
      
      // Your backend returns { success: true, data: [...], total: X, skip: X, limit: X }
      if (response.data && response.data.success === true) {
        meetingsArray = response.data.data || [];
      } else if (Array.isArray(response.data)) {
        meetingsArray = response.data;
      } else {
        meetingsArray = [];
      }
      
   
      if (isMountedRef.current) {
        setRecurringMeetings(meetingsArray);
      }
      
      return meetingsArray;
    } catch (err) {
      console.error('Failed to load recurring meetings:', err);
      if (isMountedRef.current) {
        setRecurringError(err.response?.data?.detail || err.message || 'Failed to load recurring meetings');
        setRecurringMeetings([]);
      }
      return [];
    } finally {
      if (isMountedRef.current) {
        setLoadingRecurring(false);
      }
    }
  }, []);

  const handleGenerateNextOccurrence = useCallback(async (recurringMeeting) => {
    if (!recurringMeeting?.id) {
      return { success: false, message: 'Invalid recurring meeting data' };
    }
    
    try {
      // Generate endpoint doesn't have trailing slash
      const response = await api.post(`/recurring-meetings/${recurringMeeting.id}/generate-on-demand`);
      
      let success = false;
      let message = '';
      
      if (response.data?.success === true) {
        success = true;
        message = response.data.message || `Generated next occurrence for "${recurringMeeting.title}"`;
      } else if (response.status === 200 || response.status === 201) {
        success = true;
        message = `Successfully generated next occurrence for "${recurringMeeting.title}"`;
      } else {
        success = false;
        message = 'Failed to generate occurrence';
      }
      
      // Refresh the list after generation
      if (success) {
        await loadRecurringMeetings();
      }
      
      return { success, message };
    } catch (err) {
      console.error('Failed to generate occurrence:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate occurrence';
      return { success: false, message: errorMessage };
    }
  }, [loadRecurringMeetings]);

  return {
    meetings,
    loading,
    error,
    pagination,
    recurringMeetings,
    loadingRecurring,
    recurringError,
    loadMeetings,
    loadRecurringMeetings,
    handleGenerateNextOccurrence
  };
};