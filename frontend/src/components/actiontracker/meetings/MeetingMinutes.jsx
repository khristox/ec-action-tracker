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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { format } from 'date-fns';
import {
  selectMeetingMinutes,
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
  const hasFetchedRef = useRef(false);
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
  // ✅ Add key to force remount of EditMinuteDialog
  const [editDialogKey, setEditDialogKey] = useState(0);

  const canEdit = meetingStatus !== 'cancelled' && meetingStatus !== 'ended' && meetingStatus !== 'closed';

  // ==================== API CALLS ====================

  const fetchMinutes = useCallback(async () => {
    if (!meetingId || !isMountedRef.current) return;

    if (fetchAttemptedRef.current) return;
    fetchAttemptedRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/action-tracker/meetings/${meetingId}/minutes`);
      
      if (isMountedRef.current) {
        const minutesData = response.data?.items || response.data || [];
        setMinutes(minutesData);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching minutes:', err);
        setError(err.message || 'Failed to load minutes');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setTimeout(() => {
          fetchAttemptedRef.current = false;
        }, 500);
      }
    }
  }, [meetingId]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    isMountedRef.current = true;

    if (meetingId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchMinutes();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [meetingId]);

  useEffect(() => {
    if (minutesList && isMountedRef.current) {
      const currentString = JSON.stringify(minutesList);
      if (currentString !== previousMinutesStringRef.current) {
        previousMinutesStringRef.current = currentString;
        setMinutes(minutesList);
      }
    }
  }, [minutesList]);

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
    hasFetchedRef.current = false;
    previousMinutesStringRef.current = '';
    fetchMinutes();
    if (onRefresh) onRefresh();
  }, [fetchMinutes, onRefresh]);

  const handleAddMinute = async (data) => {
    try {
      const response = await api.post(`/action-tracker/meetings/${meetingId}/minutes`, data);
      setSuccessMessage('Minutes added successfully!');
      setAddDialogOpen(false);
      fetchAttemptedRef.current = false;
      hasFetchedRef.current = false;
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
      // ✅ Increment key to force remount and reset form state
      setEditDialogKey(prev => prev + 1);
      fetchAttemptedRef.current = false;
      hasFetchedRef.current = false;
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
      fetchAttemptedRef.current = false;
      hasFetchedRef.current = false;
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

  // ✅ Handler to close edit dialog and reset form
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedMinute(null);
    // ✅ Increment key when closing to ensure clean state
    setEditDialogKey(prev => prev + 1);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
          Meeting Minutes({minutes.length})
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
        </Box>
      </Box>

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
                    <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 2, pr: 1 }}>
                      <DescriptionIcon sx={{ color: isDarkMode ? '#818CF8' : '#6366F1' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                          {minute.topic || minute.title || 'Untitled Minutes'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
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
                        </Box>
                      </Box>
                      {canEdit && (
                        // ✅ FIX: Use a div with onClick instead of IconButton inside AccordionSummary
                        // This prevents nested buttons
                        <Box 
                          component="div" 
                          onClick={(e) => e.stopPropagation()} 
                          sx={{ display: 'flex', gap: 0.5 }}
                        >
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMinute(minute);
                                setEditDialogOpen(true);
                              }}
                              sx={{ color: isDarkMode ? '#A78BFA' : 'secondary.main' }}
                              // ✅ Add this to prevent the button from triggering the accordion
                              component="span"
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
                              // ✅ Add this to prevent the button from triggering the accordion
                              component="span"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>
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
      {/* ✅ Add key prop to force remount and reset form state */}
      {selectedMinute && (
        <EditMinuteDialog
          key={editDialogKey}
          open={editDialogOpen}
          onClose={handleCloseEditDialog}
          onSave={handleEditMinute}
          minute={selectedMinute}
          loading={loading}
        />
      )}
    </Box>
  );
};

export default MeetingMinutes;