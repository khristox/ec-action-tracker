// src/components/actiontracker/meetings/components/AssignUserDialog.jsx

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, LinearProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  useMediaQuery, useTheme, IconButton, Typography,
  Stack, Box, alpha
} from '@mui/material';
import { Close as Close, Assignment as AssignmentIcon } from '@mui/icons-material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addMinutes } from 'date-fns';
import { useDispatch } from 'react-redux';
import { updateAction } from '../../../../store/slices/actionTracker/actionSlice';
import AssignToSelector from './AssignToSelector';

// Elegant dark palette
const DARK = {
  bg: '#0B0B0D',
  surface: '#161618',
  surfaceAlt: '#1D1D20',
  surfaceLight: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  textPrimary: '#FFFFFF',
  textSecondary: '#A3A3AA',
  textMuted: '#6B7280',
};

const AssignUserDialog = ({ open, action, onClose, onAssign, meetingId }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';
  const dispatch = useDispatch();

  const effectiveMeetingId = meetingId || action?.minutes?.meeting_id || action?.meeting_id;

  const [formData, setFormData] = useState({
    description: '',
    assigned_to: null,
    due_date: null,
    priority: 2,
    remarks: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && action) {
      let currentAssignment = null;
      
      if (action.assigned_to) {
        currentAssignment = {
          type: 'user',
          id: action.assigned_to.id,
          name: action.assigned_to.full_name || action.assigned_to.username,
          email: action.assigned_to.email,
          phone: action.assigned_to.phone || action.assigned_to.telephone,
          assigned_to_id: action.assigned_to.id,
          assigned_to_name: {
            id: action.assigned_to.id,
            name: action.assigned_to.full_name || action.assigned_to.username,
            email: action.assigned_to.email,
            phone: action.assigned_to.phone || action.assigned_to.telephone,
            type: 'user'
          }
        };
      } else if (action.assigned_to_name) {
        try {
          const data = typeof action.assigned_to_name === 'string' 
            ? JSON.parse(action.assigned_to_name) 
            : action.assigned_to_name;
          
          currentAssignment = {
            type: data.type || 'manual',
            id: data.id,
            name: data.name,
            email: data.email || '',
            phone: data.phone || '',
            // NOTE: assigned_to_id is a FK into `users`. Only carry it forward
            // when this assignment actually is a user; otherwise leave it null
            // so we don't accidentally resend a non-user id later.
            assigned_to_id: data.type === 'user' ? (action.assigned_to_id || data.id) : null,
            assigned_to_name: data
          };
        } catch (e) {
          currentAssignment = null;
        }
      }

      setFormData({
        description: action.description || '',
        assigned_to: currentAssignment,
        due_date: action.due_date ? new Date(action.due_date) : null,
        priority: action.priority || 2,
        remarks: action.remarks || ''
      });
    }
  }, [open, action]);

  const handleUpdateAssignment = async () => {
    if (!formData.assigned_to) {
      setError('Please select a person to assign');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let assignedToName = null;
      let assignedToId = null;

      if (formData.assigned_to) {
        // assigned_to_id is a foreign key into the `users` table on the backend.
        // Only send it when the selection is actually a registered user —
        // any other assignment type (manual entry, contact, attendee, etc.)
        // must send null or the UPDATE will fail with a FK violation.
        const isUserAssignment = formData.assigned_to.type === 'user';
        assignedToId = isUserAssignment
          ? (formData.assigned_to.assigned_to_id || formData.assigned_to.id)
          : null;
        assignedToName = formData.assigned_to.assigned_to_name || {
          id: formData.assigned_to.id,
          name: formData.assigned_to.name,
          email: formData.assigned_to.email || '',
          phone: formData.assigned_to.phone || '',
          type: formData.assigned_to.type || 'manual'
        };
      }

      const payload = {
        assigned_to_id: assignedToId,
        assigned_to_name: assignedToName,
        due_date: formData.due_date ? formData.due_date.toISOString() : null,
        priority: formData.priority,
        remarks: formData.remarks
      };

      const result = await dispatch(updateAction({ 
        id: action.id, 
        actionData: payload 
      })).unwrap();
      
      if (onAssign) onAssign();
      onClose();
    } catch (err) {
      console.error('Error updating assignment:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to update assignment');
    } finally {
      setLoading(false);
    }
  };

  // Dialog Paper styles - dark mode compliant
  const paperSx = {
    bgcolor: isDarkMode ? DARK.surface : '#FFFFFF',
    borderRadius: 2,
    backgroundImage: 'none',
  };

  // DialogTitle styles
  const titleSx = {
    m: 0, 
    p: 2, 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    bgcolor: isMobile 
      ? (isDarkMode ? DARK.surfaceAlt : 'primary.main') 
      : (isDarkMode ? DARK.surfaceAlt : 'transparent'),
    color: isMobile 
      ? (isDarkMode ? DARK.textPrimary : 'white') 
      : (isDarkMode ? DARK.textPrimary : 'inherit'),
    borderBottom: isDarkMode ? `1px solid ${DARK.border}` : 'none',
  };

  // Action card styles
  const actionCardSx = {
    bgcolor: isDarkMode ? DARK.surfaceLight : '#f8fafc',
    p: 2, 
    borderRadius: 2, 
    border: `1px solid ${isDarkMode ? DARK.border : '#e2e8f0'}`,
  };

  // TextField styles
  const textFieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: isDarkMode ? DARK.surfaceLight : 'transparent',
      '& fieldset': {
        borderColor: isDarkMode ? DARK.border : 'rgba(0,0,0,0.12)',
      },
      '&:hover fieldset': {
        borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
      },
      '&.Mui-focused fieldset': {
        borderColor: isDarkMode ? '#60A5FA' : 'primary.main',
      }
    },
    '& .MuiInputLabel-root': {
      color: isDarkMode ? DARK.textSecondary : 'inherit',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: isDarkMode ? '#60A5FA' : 'primary.main',
    },
    '& .MuiInputBase-input': {
      color: isDarkMode ? DARK.textPrimary : 'inherit',
    }
  };

  // Select styles
  const selectSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: isDarkMode ? DARK.surfaceLight : 'transparent',
      '& fieldset': {
        borderColor: isDarkMode ? DARK.border : 'rgba(0,0,0,0.12)',
      },
      '&:hover fieldset': {
        borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
      },
      '&.Mui-focused fieldset': {
        borderColor: isDarkMode ? '#60A5FA' : 'primary.main',
      }
    },
    '& .MuiInputLabel-root': {
      color: isDarkMode ? DARK.textSecondary : 'inherit',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: isDarkMode ? '#60A5FA' : 'primary.main',
    },
    '& .MuiSelect-select': {
      color: isDarkMode ? DARK.textPrimary : 'inherit',
    },
    '& .MuiSelect-icon': {
      color: isDarkMode ? DARK.textSecondary : 'inherit',
    }
  };

  // MenuItem styles
  const menuItemSx = {
    color: isDarkMode ? DARK.textPrimary : 'inherit',
    '&:hover': {
      bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    },
    '&.Mui-selected': {
      bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.15)' : 'rgba(25, 118, 210, 0.08)',
      '&:hover': {
        bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.25)' : 'rgba(25, 118, 210, 0.12)',
      }
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={onClose} 
        fullWidth 
        maxWidth="sm" 
        fullScreen={isMobile}
        slotProps={{
          paper: {
            sx: paperSx
          }
        }}
      >
        <DialogTitle sx={titleSx}>
          <Typography 
            variant="h6" 
            component="div"
            sx={{ 
              fontWeight: 600,
              color: isDarkMode ? DARK.textPrimary : 'inherit'
            }}
          >
            Update Assignment
          </Typography>
          {isMobile && (
            <IconButton 
              onClick={onClose} 
              sx={{ 
                color: isDarkMode ? DARK.textSecondary : 'white' 
              }}
            >
              <Close />
            </IconButton>
          )}
        </DialogTitle>

        {loading && <LinearProgress sx={{ bgcolor: isDarkMode ? DARK.surfaceLight : undefined }} />}
        
        <DialogContent dividers sx={{ 
          p: isMobile ? 2 : 3,
          bgcolor: isDarkMode ? DARK.bg : 'transparent',
          '& .MuiDivider-root': {
            borderColor: isDarkMode ? DARK.border : 'rgba(0,0,0,0.06)',
          }
        }}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2, 
                borderRadius: 2,
                bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : undefined,
                color: isDarkMode ? '#F87171' : undefined,
                '& .MuiAlert-icon': {
                  color: isDarkMode ? '#F87171' : undefined,
                }
              }} 
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}
          
          <Stack spacing={3}>
            {/* Current Action Card */}
            <Box sx={actionCardSx}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <AssignmentIcon 
                  color="primary" 
                  sx={{ 
                    mt: 0.5,
                    color: isDarkMode ? '#60A5FA' : undefined,
                  }} 
                />
                <Box flex={1}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? DARK.textSecondary : 'text.secondary',
                      display: 'block',
                      mb: 0.5,
                    }}
                  >
                    Action Item
                  </Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight={500}
                    sx={{ 
                      color: isDarkMode ? DARK.textPrimary : 'inherit',
                    }}
                  >
                    {formData.description}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Assign To Selector */}
            <AssignToSelector
              value={formData.assigned_to}
              onChange={(userObj) => setFormData({ ...formData, assigned_to: userObj })}
              disabled={loading}
              label="Assign To"
              meetingId={effectiveMeetingId}
            />

            {/* Due Date Picker */}
            <DateTimePicker
              label="Due Date & Time"
              value={formData.due_date}
              onChange={(val) => setFormData({ ...formData, due_date: val })}
              disablePast
              minDateTime={addMinutes(new Date(), 5)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  helperText: "Must be a future date",
                  sx: textFieldSx,
                  disabled: loading,
                },
                popper: {
                  sx: {
                    '& .MuiPaper-root': {
                      bgcolor: isDarkMode ? DARK.surface : '#FFFFFF',
                      color: isDarkMode ? DARK.textPrimary : 'inherit',
                      border: isDarkMode ? `1px solid ${DARK.border}` : 'none',
                    },
                    '& .MuiPickersDay-root': {
                      color: isDarkMode ? DARK.textPrimary : 'inherit',
                      '&:hover': {
                        bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                      },
                      '&.Mui-selected': {
                        bgcolor: isDarkMode ? '#7C3AED' : 'primary.main',
                        color: '#FFFFFF',
                      },
                    },
                    '& .MuiClockPicker-root': {
                      bgcolor: isDarkMode ? DARK.surface : '#FFFFFF',
                    },
                    '& .MuiPickersToolbar-root': {
                      bgcolor: isDarkMode ? DARK.surfaceAlt : 'primary.main',
                    },
                    '& .MuiTypography-root': {
                      color: isDarkMode ? DARK.textPrimary : 'inherit',
                    },
                  }
                }
              }}
            />

            {/* Priority Selector */}
            <FormControl fullWidth sx={selectSx}>
              <InputLabel sx={{ 
                color: isDarkMode ? DARK.textSecondary : 'inherit',
                '&.Mui-focused': {
                  color: isDarkMode ? '#60A5FA' : 'primary.main',
                }
              }}>
                Priority
              </InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                label="Priority"
                disabled={loading}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: isDarkMode ? DARK.surface : '#FFFFFF',
                      border: isDarkMode ? `1px solid ${DARK.border}` : 'none',
                      '& .MuiMenuItem-root': menuItemSx,
                    }
                  }
                }}
              >
                <MenuItem value={1} sx={menuItemSx}>🔴 High - Urgent</MenuItem>
                <MenuItem value={2} sx={menuItemSx}>🟠 Medium - Normal</MenuItem>
                <MenuItem value={3} sx={menuItemSx}>🟢 Low - Flexible</MenuItem>
                <MenuItem value={4} sx={menuItemSx}>⚪ Very Low - Info Only</MenuItem>
              </Select>
            </FormControl>

            {/* Remarks */}
            <TextField
              fullWidth
              label="Remarks / Notes"
              multiline
              rows={3}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Add any notes about this assignment..."
              disabled={loading}
              sx={textFieldSx}
              slotProps={{
                input: {
                  sx: {
                    color: isDarkMode ? DARK.textPrimary : 'inherit',
                  }
                }
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ 
          p: 2, 
          flexDirection: isMobile ? 'column' : 'row',
          gap: 1,
          bgcolor: isDarkMode ? DARK.surfaceAlt : 'transparent',
          borderTop: isDarkMode ? `1px solid ${DARK.border}` : 'none',
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
        }}>
          <Button 
            fullWidth={isMobile} 
            onClick={onClose} 
            disabled={loading}
            color="inherit"
            sx={{ 
              order: isMobile ? 2 : 1,
              color: isDarkMode ? DARK.textSecondary : 'inherit',
              '&:hover': {
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              }
            }}
          >
            Cancel
          </Button>
          <Button
            fullWidth={isMobile}
            variant="contained"
            onClick={handleUpdateAssignment}
            disabled={loading || !formData.assigned_to}
            sx={{ 
              order: isMobile ? 1 : 2, 
              py: isMobile ? 1.5 : 1,
              bgcolor: isDarkMode ? '#7C3AED' : undefined,
              '&:hover': {
                bgcolor: isDarkMode ? '#6D28D9' : undefined,
              },
              '&.Mui-disabled': {
                bgcolor: isDarkMode ? 'rgba(124, 58, 237, 0.3)' : undefined,
              }
            }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AssignUserDialog;