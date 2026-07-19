// src/components/meetings/MeetingMinutes.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  useTheme,
  alpha,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Description as DescriptionIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
  fetchMeetingMinutes,
  selectMeetingMinutes,
  clearMeetingMinutes,
  fetchActionTrackerAttributes,
} from '../../../store/slices/actionTracker/meetingSlice';
import AddMinutesDialog from './components/AddMinutesDialog';
import EditMinuteDialog from "./components/EditMinuteDialog";
import api from '../../../services/api';

// ==================== HELPER FUNCTIONS ====================

const safeFormatDate = (dateVal, pattern = 'MMM d, yyyy', fallback = 'Unknown date') => {
  if (!dateVal) return fallback;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return fallback;
  try {
    return format(d, pattern);
  } catch {
    return fallback;
  }
};

const stripHtmlTags = (html) => {
  if (!html) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
};

const getPlainTextPreview = (html, maxLength = 150) => {
  const plainText = stripHtmlTags(html);
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength) + '...';
};

// ==================== MAIN COMPONENT ====================

const MeetingMinutes = ({ meetingId, meetingStatus, onRefresh }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // ==================== REDUX SELECTORS ====================
  const minutesList = useSelector(selectMeetingMinutes);

  // ==================== REFS FOR PREVENTING INFINITE LOOPS ====================
  const isMountedRef = useRef(true);
  const fetchAttemptedRef = useRef(false);
  const previousMinutesStringRef = useRef('');

  // ==================== LOCAL STATE ====================
  const [minutes, setMinutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMinute, setSelectedMinute] = useState(null);
  const [expandedMinutes, setExpandedMinutes] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');

  const canEdit = meetingStatus !== 'cancelled' && meetingStatus !== 'ended' && meetingStatus !== 'closed';

  // ==================== API CALLS ====================

  // ✅ FIXED: fetchMinutes is stable and only depends on meetingId
  const fetchMinutes = useCallback(async () => {
    if (!meetingId || !isMountedRef.current) return;

    // Prevent concurrent requests
    if (fetchAttemptedRef.current) return;
    fetchAttemptedRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/action-tracker/meetings/${meetingId}/minutes`);
      
      if (isMountedRef.current) {
        // ✅ Store in Redux and local state
        const minutesData = response.data?.items || response.data || [];
        setMinutes(minutesData);
        
        // Also update the Redux store if needed
        // dispatch(fetchMeetingMinutes(meetingId)); // Uncomment if you want to use Redux
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching minutes:', err);
        setError(err.message || 'Failed to load minutes');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        // Reset the fetch attempt after a short delay
        setTimeout(() => {
          fetchAttemptedRef.current = false;
        }, 500);
      }
    }
  }, [meetingId]);

  // ==================== EFFECTS ====================

  // ✅ FIXED: Initial fetch - only runs once when meetingId changes
  useEffect(() => {
    isMountedRef.current = true;
    fetchAttemptedRef.current = false;
    previousMinutesStringRef.current = '';

    if (meetingId) {
      fetchMinutes();
    }

    return () => {
      isMountedRef.current = false;
      fetchAttemptedRef.current = false;
    };
  }, [meetingId, fetchMinutes]);

  // ✅ FIXED: Update local state when Redux state changes
  useEffect(() => {
    if (minutesList && isMountedRef.current) {
      const currentString = JSON.stringify(minutesList);
      if (currentString !== previousMinutesStringRef.current) {
        previousMinutesStringRef.current = currentString;
        setMinutes(minutesList);
      }
    }
  }, [minutesList]);

  // ✅ FIXED: Success message cleanup
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          setSuccessMessage('');
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // ==================== HANDLERS ====================

  const handleRefresh = useCallback(() => {
    if (!isMountedRef.current) return;
    fetchAttemptedRef.current = false;
    previousMinutesStringRef.current = '';
    fetchMinutes();
    if (onRefresh) onRefresh();
  }, [fetchMinutes, onRefresh]);

  const handleAddMinute = async (data) => {
    try {
      const response = await api.post(`/action-tracker/meetings/${meetingId}/minutes`, data);
      setSuccessMessage('Minutes added successfully!');
      setAddDialogOpen(false);
      // Refresh the list
      fetchAttemptedRef.current = false;
      fetchMinutes();
      return response.data;
    } catch (err) {
      throw err;
    }
  };

  const handleEditMinute = async (data) => {
    try {
      const response = await api.put(`/action-tracker/meetings/${meetingId}/minutes/${selectedMinute.id}`, data);
      setSuccessMessage('Minutes updated successfully!');
      setEditDialogOpen(false);
      setSelectedMinute(null);
      // Refresh the list
      fetchAttemptedRef.current = false;
      fetchMinutes();
      return response.data;
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteMinute = async (minuteId) => {
    if (!window.confirm('Are you sure you want to delete these minutes?')) return;
    
    try {
      await api.delete(`/action-tracker/meetings/${meetingId}/minutes/${minuteId}`);
      setSuccessMessage('Minutes deleted successfully!');
      // Refresh the list
      fetchAttemptedRef.current = false;
      fetchMinutes();
    } catch (err) {
      setError(err.message || 'Failed to delete minutes');
    }
  };

  const handleToggleExpand = (minuteId) => {
    setExpandedMinutes(prev =>
      prev.includes(minuteId)
        ? prev.filter(id => id !== minuteId)
        : [...prev, minuteId]
    );
  };

  // ==================== RENDER ====================

  if (loading && minutes.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', mt: 2 }}>
          Loading minutes...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
          Meeting Minutes ({minutes.length})
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title={!canEdit ? "Meeting must be active to add minutes" : "Add new minutes"}>
            <span>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddDialogOpen(true)}
                size="small"
                disabled={!canEdit}
                sx={{
                  bgcolor: isDarkMode ? '#7C3AED' : undefined,
                  '&:hover': { bgcolor: isDarkMode ? '#6D28D9' : undefined }
                }}
              >
                Add Minutes
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton
              onClick={handleRefresh}
              size="small"
              disabled={loading}
              sx={{
                color: isDarkMode ? '#D1D5DB' : 'inherit',
                '&:hover': { backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04) }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Messages */}
      {successMessage && (
        <Alert
          severity="success"
          sx={{
            mb: 3,
            borderRadius: 2,
            bgcolor: isDarkMode ? alpha('#10B981', 0.1) : undefined,
            color: isDarkMode ? '#34D399' : undefined
          }}
          onClose={() => setSuccessMessage('')}
        >
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: 2,
            bgcolor: isDarkMode ? alpha('#EF4444', 0.1) : undefined,
            color: isDarkMode ? '#F87171' : undefined
          }}
          onClose={() => setError(null)}
        >
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </Alert>
      )}

      {/* Minutes List */}
      {minutes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <DescriptionIcon sx={{ fontSize: 64, color: isDarkMode ? '#6B7280' : 'action.disabled', mb: 2 }} />
          <Typography variant="body1" sx={{ color: isDarkMode ? '#D1D5DB' : 'text.secondary' }} gutterBottom>
            No minutes found for this meeting.
          </Typography>
          {canEdit && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              sx={{ mt: 2 }}
            >
              Add First Minutes
            </Button>
          )}
        </Box>
      ) : (
        <Stack spacing={2}>
          {minutes.map((minute) => {
            const isExpanded = expandedMinutes.includes(minute.id);
            const actionCount = minute.actions?.length || 0;
            const discussionPreview = getPlainTextPreview(minute.discussion, 200);

            return (
              <Paper
                key={minute.id}
                sx={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB'}`,
                  bgcolor: isDarkMode ? '#1F2937' : 'background.paper',
                }}
              >
                <Accordion
                  expanded={isExpanded}
                  onChange={() => handleToggleExpand(minute.id)}
                  sx={{
                    bgcolor: 'transparent',
                    boxShadow: 'none',
                    '&:before': { display: 'none' },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }} />}
                    sx={{
                      px: 3,
                      py: 1.5,
                      '&:hover': { bgcolor: isDarkMode ? alpha('#FFFFFF', 0.03) : alpha('#000000', 0.02) },
                    }}
                  >
                    <Stack direction="row" spacing={2} sx={{ width: '100%', alignItems: 'center' }}>
                      <DescriptionIcon sx={{ color: isDarkMode ? '#818CF8' : '#6366F1' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                          {minute.topic || minute.title || 'Untitled Minutes'}
                        </Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                            {safeFormatDate(minute.created_at)}
                          </Typography>
                          {actionCount > 0 && (
                            <Chip
                              label={`${actionCount} action${actionCount !== 1 ? 's' : ''}`}
                              size="small"
                              icon={<AssignmentIcon sx={{ fontSize: 14 }} />}
                              sx={{
                                height: 22,
                                bgcolor: isDarkMode ? alpha('#818CF8', 0.15) : alpha('#6366F1', 0.1),
                                color: isDarkMode ? '#818CF8' : '#6366F1',
                                '& .MuiChip-label': { fontSize: '0.65rem' },
                                '& .MuiChip-icon': { fontSize: 14 },
                              }}
                            />
                          )}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        {canEdit && (
                          <>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMinute(minute);
                                  setEditDialogOpen(true);
                                }}
                                sx={{ color: isDarkMode ? '#A78BFA' : 'secondary.main' }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMinute(minute.id);
                                }}
                                sx={{ color: isDarkMode ? '#F87171' : 'error.main' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 3, pb: 3, pt: 1 }}>
                    <Divider sx={{ mb: 2, borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#E5E7EB' }} />
                    <Stack spacing={2}>
                      {minute.discussion && (
                        <Box>
                          <Typography variant="caption" fontWeight={600} sx={{ color: isDarkMode ? '#D1D5DB' : 'text.secondary' }}>
                            Discussion
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              mt: 0.5,
                              color: isDarkMode ? '#D1D5DB' : 'text.primary',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {minute.discussion}
                          </Typography>
                        </Box>
                      )}
                      {minute.decisions && (
                        <Box>
                          <Typography variant="caption" fontWeight={600} sx={{ color: isDarkMode ? '#D1D5DB' : 'text.secondary' }}>
                            Decisions
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              mt: 0.5,
                              color: isDarkMode ? '#D1D5DB' : 'text.primary',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {minute.decisions}
                          </Typography>
                        </Box>
                      )}
                      {actionCount > 0 && (
                        <Box>
                          <Typography variant="caption" fontWeight={600} sx={{ color: isDarkMode ? '#D1D5DB' : 'text.secondary' }}>
                            Actions ({actionCount})
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            {minute.actions.map((action) => (
                              <Chip
                                key={action.id}
                                label={action.description}
                                size="small"
                                variant="outlined"
                                sx={{
                                  mr: 1,
                                  mb: 1,
                                  borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
                                  color: isDarkMode ? '#D1D5DB' : 'text.primary',
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Add Minutes Dialog */}
      <AddMinutesDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSave={handleAddMinute}
        loading={loading}
      />

      {/* Edit Minutes Dialog */}
      {selectedMinute && (
        <EditMinutesDialog
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedMinute(null);
          }}
          onSave={handleEditMinute}
          minute={selectedMinute}
          loading={loading}
        />
      )}
    </Box>
  );
};

export default MeetingMinutes;