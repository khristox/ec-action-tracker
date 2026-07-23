// src/components/actiontracker/meetings/components/AssignUserDialog_ImprovedV2.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, LinearProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  useMediaQuery, useTheme, IconButton, Typography,
  Stack, Box, alpha, Tooltip, Chip, Divider,
  Switch, FormControlLabel, Collapse
} from '@mui/material';
import {
  Close as CloseIcon,
  Assignment as AssignmentIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon,
  Shield as ShieldIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addMinutes } from 'date-fns';
import { useDispatch } from 'react-redux';
import { updateAction } from '../../../../store/slices/actionTracker/actionSlice';
import AssignToSelector from './AssignToSelector';

// ==================== ENHANCED MASKING CLASS ====================

class PrivacyMasking {
  static MASKING_PATTERNS = {
    phone: {
      description: 'Phone Number',
      pattern: /(\+?\d{1,3}[-.\s]?)?(\d{2,3})[-.\s]?\d{3}[-.\s]?(\d{4})/g,
      mask: (match, p1, p2, p3) => {
        const prefix = p1 ? p1 : '';
        return `${prefix}${p2 ? p2 : '***'}-***-${p3}`;
      }
    },
    email: {
      description: 'Email Address',
      pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      mask: (email) => PrivacyMasking.maskEmail(email)
    },
    ssn: {
      description: 'Social Security Number',
      pattern: /\d{3}-\d{2}-\d{4}/g,
      mask: () => '***-**-****'
    },
    bankAccount: {
      description: 'Bank Account',
      pattern: /\b\d{8,12}\b/g,
      mask: (match) => '*'.repeat(match.length - 4) + match.slice(-4)
    }
  };

  static maskEmail(email) {
    // Defensive: ensure email is a string
    if (!email || typeof email !== 'string') return '';
    
    const emailStr = String(email).trim();
    if (!emailStr.includes('@')) return emailStr;
    
    const parts = emailStr.split('@');
    const localPart = parts[0] || '';
    const domain = parts[1] || '';
    
    if (!domain) return emailStr;

    let maskedLocal = localPart.length <= 3
      ? localPart.charAt(0) + '*'.repeat(Math.max(0, localPart.length - 1))
      : localPart.substring(0, 2) + '*'.repeat(Math.max(0, localPart.length - 3)) + localPart.charAt(localPart.length - 1);

    const domainParts = domain.split('.');
    const domainName = domainParts[0] || '';
    const tld = domainParts[1] || '';
    
    if (!tld) return `${maskedLocal}@${domain}`;

    let maskedDomain = domainName.length <= 3
      ? domainName.charAt(0) + '*'.repeat(Math.max(0, domainName.length - 1))
      : domainName.substring(0, 2) + '*'.repeat(Math.max(0, domainName.length - 3)) + domainName.charAt(domainName.length - 1);

    return `${maskedLocal}@${maskedDomain}.${tld}`;
  }

  static maskPhoneNumber(text) {
    if (!text || typeof text !== 'string') return '';
    try {
      return text.replace(
        PrivacyMasking.MASKING_PATTERNS.phone.pattern,
        PrivacyMasking.MASKING_PATTERNS.phone.mask
      );
    } catch (e) {
      console.error('Error masking phone:', e);
      return text;
    }
  }

  static maskContactInfo(text, patterns = ['phone', 'email']) {
    if (!text || typeof text !== 'string') return '';
    try {
      let masked = String(text);
      patterns.forEach(patternKey => {
        const patternConfig = PrivacyMasking.MASKING_PATTERNS[patternKey];
        if (patternConfig) {
          masked = masked.replace(patternConfig.pattern, patternConfig.mask);
        }
      });
      return masked;
    } catch (e) {
      console.error('Error masking contact info:', e);
      return text;
    }
  }

  static getDetectedFields(text) {
    if (!text || typeof text !== 'string') return [];
    try {
      const textStr = String(text);
      const detected = [];
      if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(textStr)) detected.push('email');
      if (/(\+?\d{1,3}[-.\s]?)?(\d{2,3})[-.\s]?\d{3}[-.\s]?(\d{4})/.test(textStr)) detected.push('phone');
      if (/\d{3}-\d{2}-\d{4}/.test(textStr)) detected.push('ssn');
      return detected;
    } catch (e) {
      console.error('Error detecting fields:', e);
      return [];
    }
  }

  // Helper to safely extract name from various formats
  static safeGetName(value) {
    if (!value) return 'Unknown';
    
    // If it's a string, return it
    if (typeof value === 'string') {
      return value.trim() || 'Unknown';
    }
    
    // If it's an object, try to extract name
    if (typeof value === 'object') {
      // Try common name fields
      if (value.name && typeof value.name === 'string') {
        return value.name.trim() || 'Unknown';
      }
      if (value.full_name && typeof value.full_name === 'string') {
        return value.full_name.trim() || 'Unknown';
      }
      if (value.username && typeof value.username === 'string') {
        return value.username.trim() || 'Unknown';
      }
      if (value.displayName && typeof value.displayName === 'string') {
        return value.displayName.trim() || 'Unknown';
      }
      
      // If it has a label or title
      if (value.label && typeof value.label === 'string') {
        return value.label.trim() || 'Unknown';
      }
      if (value.title && typeof value.title === 'string') {
        return value.title.trim() || 'Unknown';
      }
      
      // Last resort: try to stringify
      try {
        return JSON.stringify(value).substring(0, 50) || 'Unknown';
      } catch {
        return 'Unknown';
      }
    }
    
    // Fallback
    return 'Unknown';
  }
}

// ==================== DARK PALETTE ====================

const DARK = {
  bg: '#0B0B0D',
  surface: '#161618',
  surfaceAlt: '#1D1D20',
  surfaceLight: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: '#A3A3AA',
  textMuted: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

// ==================== IMPROVED COMPONENT ====================

const AssignUserDialog = ({ 
  open, 
  action, 
  onClose, 
  onAssign, 
  meetingId,
  privacyMode = true,
  userRole = 'standard'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';
  const dispatch = useDispatch();

  const effectiveMeetingId = meetingId || action?.minutes?.meeting_id || action?.meeting_id;

  // ==================== STATE MANAGEMENT ====================
  
  // Original unmasked data (never changes)
  const [originalData, setOriginalData] = useState({
    description: '',
    remarks: '',
    assigned_to: null
  });

  // User input (what they're typing/editing)
  const [userInput, setUserInput] = useState({
    description: '',
    remarks: ''
  });

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    assigned_to: null,
    due_date: null,
    priority: 2,
    remarks: ''
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [maskingEnabled, setMaskingEnabled] = useState(privacyMode);
  const [copiedField, setCopiedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [detectedSensitiveFields, setDetectedSensitiveFields] = useState({
    description: [],
    remarks: []
  });

  const canViewUnmasked = useMemo(() => userRole === 'admin' || userRole === 'super_admin', [userRole]);

  // ==================== EFFECTS ====================

  // Initialize form when dialog opens
  useEffect(() => {
    if (open && action) {
      // Simple single-user assignment (old method)
      let currentAssignment = null;

      if (action.assigned_to_id) {
        // Using assigned_to_id directly
        const name = PrivacyMasking.safeGetName(action.assigned_to_name);
        currentAssignment = {
          id: action.assigned_to_id,
          name: name,
          email: String(action.assigned_to_email || ''),
          phone: String(action.assigned_to_phone || ''),
        };
      } else if (action.assigned_to) {
        // Fallback to assigned_to object
        const name = PrivacyMasking.safeGetName(
          action.assigned_to.full_name || 
          action.assigned_to.username || 
          action.assigned_to.name
        );
        currentAssignment = {
          id: action.assigned_to.id,
          name: name,
          email: String(action.assigned_to.email || ''),
          phone: String(action.assigned_to.phone || action.assigned_to.telephone || ''),
        };
      }

      const rawDescription = String(action.description || '');
      const rawRemarks = String(action.remarks || '');

      // Store original data
      setOriginalData({
        description: rawDescription,
        remarks: rawRemarks,
        assigned_to: currentAssignment
      });

      // Store user input (starts as original)
      setUserInput({
        description: rawDescription,
        remarks: rawRemarks
      });

      // Detect sensitive fields in original data
      setDetectedSensitiveFields({
        description: PrivacyMasking.getDetectedFields(rawDescription),
        remarks: PrivacyMasking.getDetectedFields(rawRemarks)
      });

      // Set form data (display version)
      updateFormDisplay(rawDescription, rawRemarks, currentAssignment, maskingEnabled);
    }
  }, [open, action]);

  // Update form display based on privacy mode
  const updateFormDisplay = (desc, remarks, assignment, privacy) => {
    const displayDesc = privacy ? PrivacyMasking.maskContactInfo(desc, ['phone', 'email']) : desc;
    const displayRemarks = privacy ? PrivacyMasking.maskContactInfo(remarks, ['phone', 'email']) : remarks;

    setFormData(prev => ({
      ...prev,
      description: displayDesc,
      assigned_to: assignment,
      remarks: displayRemarks
    }));
  };

  // Handle privacy toggle - update display immediately
  const handlePrivacyToggle = (e) => {
    const newPrivacy = e.target.checked;
    setMaskingEnabled(newPrivacy);
    updateFormDisplay(userInput.description, userInput.remarks, formData.assigned_to, newPrivacy);
  };

  // ==================== HANDLERS ====================

  const handleDescriptionChange = (e) => {
    const value = e.target.value;
    setUserInput(prev => ({ ...prev, description: value }));
    
    const detected = PrivacyMasking.getDetectedFields(value);
    setDetectedSensitiveFields(prev => ({ ...prev, description: detected }));

    const displayValue = maskingEnabled ? PrivacyMasking.maskContactInfo(value, ['phone', 'email']) : value;
    setFormData(prev => ({ ...prev, description: displayValue }));
  };

  const handleRemarksChange = (e) => {
    const value = e.target.value;
    setUserInput(prev => ({ ...prev, remarks: value }));
    
    const detected = PrivacyMasking.getDetectedFields(value);
    setDetectedSensitiveFields(prev => ({ ...prev, remarks: detected }));

    const displayValue = maskingEnabled ? PrivacyMasking.maskContactInfo(value, ['phone', 'email']) : value;
    setFormData(prev => ({ ...prev, remarks: displayValue }));
  };

  const handleCopyToClipboard = useCallback((field) => {
    const value = userInput[field];
    if (value) {
      navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, [userInput]);

  const handleAssignmentChange = (userObj) => {
    // Simple single-user assignment
    if (userObj) {
      try {
        // Safely get name from user object - handle various formats
        let name = 'Unknown';
        
        // If userObj has a name property
        if (userObj.name) {
          name = PrivacyMasking.safeGetName(userObj.name);
        } else if (userObj.full_name) {
          name = PrivacyMasking.safeGetName(userObj.full_name);
        } else if (userObj.username) {
          name = PrivacyMasking.safeGetName(userObj.username);
        } else if (userObj.displayName) {
          name = PrivacyMasking.safeGetName(userObj.displayName);
        } else if (userObj.label) {
          name = PrivacyMasking.safeGetName(userObj.label);
        } else if (userObj.title) {
          name = PrivacyMasking.safeGetName(userObj.title);
        } else {
          // Try to convert to string
          try {
            const strValue = String(userObj);
            if (strValue && strValue !== '[object Object]') {
              name = strValue;
            }
          } catch (e) {
            // Ignore
          }
        }

        // Get ID
        let id = userObj.id || userObj.assigned_to_id || null;
        
        // If no ID but we have name, use name as ID
        if (!id && name !== 'Unknown') {
          id = name;
        }

        const assignedUser = {
          id: id,
          name: String(name || '').trim() || 'Unknown',
          email: String(userObj.email || '').trim(),
          phone: String(userObj.phone || userObj.telephone || '').trim(),
        };
        
        setFormData(prev => ({ ...prev, assigned_to: assignedUser }));
      } catch (e) {
        console.error('Error setting assignment:', e);
        setError('Error selecting user. Please try again.');
      }
    } else {
      setFormData(prev => ({ ...prev, assigned_to: null }));
    }
  };

  const handleUpdateAssignment = async () => {
    if (!formData.assigned_to) {
      setError('Please select a person to assign');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Simple single-user assignment (old method)
      const payload = {
        assigned_to_id: formData.assigned_to.id,
        assigned_to_name: formData.assigned_to.name,
        assigned_to_email: formData.assigned_to.email,
        assigned_to_phone: formData.assigned_to.phone,
        due_date: formData.due_date ? formData.due_date.toISOString() : null,
        priority: formData.priority,
        remarks: userInput.remarks  // Send original user input
      };

      await dispatch(updateAction({
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

  // ==================== STYLES ====================

  const paperSx = {
    bgcolor: isDarkMode ? DARK.surface : '#FFFFFF',
    borderRadius: 2,
    backgroundImage: 'none',
  };

  const titleSx = {
    m: 0,
    p: 2,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    bgcolor: isMobile ? (isDarkMode ? DARK.surfaceAlt : 'primary.main') : (isDarkMode ? DARK.surfaceAlt : 'transparent'),
    color: isMobile ? (isDarkMode ? DARK.textPrimary : 'white') : (isDarkMode ? DARK.textPrimary : 'inherit'),
    borderBottom: isDarkMode ? `1px solid ${DARK.border}` : 'none',
  };

  const actionCardSx = {
    bgcolor: isDarkMode ? DARK.surfaceLight : '#f8fafc',
    p: 2,
    borderRadius: 2,
    border: `1px solid ${isDarkMode ? DARK.border : '#e2e8f0'}`,
  };

  const privacyNoticeSx = {
    bgcolor: isDarkMode ? alpha(DARK.warning, 0.1) : 'rgba(245, 158, 11, 0.1)',
    borderLeft: `3px solid ${DARK.warning}`,
    p: 2,
    borderRadius: 1,
    mb: 2
  };

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

  // ==================== RENDER ====================

  const hasSensitiveData = detectedSensitiveFields.description.length > 0 || 
                          detectedSensitiveFields.remarks.length > 0;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        fullScreen={isMobile}
        slotProps={{ paper: { sx: paperSx } }}
      >
        {/* Title */}
        <DialogTitle sx={titleSx}>
          <Stack direction="row" spacing={1} alignItems="center" flex={1}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: isDarkMode ? DARK.textPrimary : 'inherit' }}>
              Update User Assignment
            </Typography>
            {maskingEnabled && hasSensitiveData && (
              <Tooltip title="Data Privacy Enabled - Sensitive info is masked">
                <ShieldIcon sx={{ fontSize: 18, color: DARK.success }} />
              </Tooltip>
            )}
          </Stack>

          {isMobile && (
            <IconButton onClick={onClose} sx={{ color: isDarkMode ? DARK.textSecondary : 'white' }}>
              <CloseIcon />
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
          {/* Privacy Notice & Toggle */}
          {hasSensitiveData && (
            <>
              <Box sx={privacyNoticeSx}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <InfoIcon sx={{ fontSize: 18, color: DARK.warning, mt: 0.5 }} />
                  <Box flex={1}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: DARK.textPrimary }}>
                      Sensitive Information Detected
                    </Typography>
                    <Typography variant="caption" sx={{ color: DARK.textSecondary, display: 'block', mt: 0.5 }}>
                      {maskingEnabled 
                        ? 'Contact information is masked for privacy.'
                        : 'Contact information is visible. Be careful who can see this.'}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Privacy Toggle - IMPROVED */}
              {canViewUnmasked && (
                <Box sx={{
                  p: 1.5,
                  mb: 2,
                  bgcolor: isDarkMode ? DARK.surfaceLight : 'rgba(0,0,0,0.02)',
                  borderRadius: 1,
                  border: `1px solid ${isDarkMode ? DARK.border : 'rgba(0,0,0,0.08)'}`
                }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={maskingEnabled}
                        onChange={handlePrivacyToggle}
                        disabled={loading}
                      />
                    }
                    label={
                      <Stack spacing={0.5}>
                        <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {maskingEnabled ? <ShieldIcon sx={{ fontSize: 16, color: DARK.success }} /> : <EditIcon sx={{ fontSize: 16, color: DARK.warning }} />}
                          Privacy Mode
                        </Typography>
                        <Typography variant="caption" sx={{ color: DARK.textSecondary }}>
                          {maskingEnabled ? 'Sensitive data is masked (safe)' : 'All data is visible (caution!)'}
                        </Typography>
                      </Stack>
                    }
                  />
                </Box>
              )}

              <Divider sx={{ my: 2 }} />
            </>
          )}

          {/* Error Alert */}
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
            {/* Action Item Card - IMPROVED */}
            <Box sx={actionCardSx}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <AssignmentIcon color="primary" sx={{ mt: 0.5, color: isDarkMode ? '#60A5FA' : undefined }} />
                <Box flex={1}>
                  <Typography variant="caption" sx={{ color: isDarkMode ? DARK.textSecondary : 'text.secondary', display: 'block', mb: 0.5 }}>
                    Action Item
                  </Typography>
                  <Typography variant="body2" fontWeight={500} sx={{ color: isDarkMode ? DARK.textPrimary : 'inherit', lineHeight: 1.6 }}>
                    {formData.description}
                  </Typography>

                  {/* Detected Badges */}
                  {detectedSensitiveFields.description.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                      {detectedSensitiveFields.description.map(fieldType => (
                        <Chip
                          key={fieldType}
                          label={PrivacyMasking.MASKING_PATTERNS[fieldType]?.description}
                          size="small"
                          variant="outlined"
                          icon={maskingEnabled ? <ShieldIcon /> : <EditIcon />}
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            borderColor: maskingEnabled ? DARK.success : DARK.warning,
                            color: maskingEnabled ? DARK.success : DARK.warning,
                          }}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              </Stack>
            </Box>

            {/* Assign To */}
            <AssignToSelector
              value={formData.assigned_to}
              onChange={handleAssignmentChange}
              disabled={loading}
              label="Assign To"
              meetingId={effectiveMeetingId}
            />

            {/* Due Date */}
            <DateTimePicker
              label="Due Date & Time"
              value={formData.due_date}
              onChange={(val) => setFormData(prev => ({ ...prev, due_date: val }))}
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
                      '&.Mui-selected': {
                        bgcolor: isDarkMode ? '#7C3AED' : 'primary.main',
                        color: '#FFFFFF',
                      },
                    },
                    '& .MuiPickersToolbar-root': {
                      bgcolor: isDarkMode ? DARK.surfaceAlt : 'primary.main',
                    },
                  }
                }
              }}
            />

            {/* Priority */}
            <FormControl fullWidth sx={selectSx}>
              <InputLabel sx={{ color: isDarkMode ? DARK.textSecondary : 'inherit' }}>Priority</InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
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

            {/* Remarks - IMPROVED with better controls */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Remarks / Notes
                </Typography>
                <Stack direction="row" spacing={1}>
                  {/* Copy Button - Only for admins with sensitive data */}
                  {canViewUnmasked && detectedSensitiveFields.remarks.length > 0 && (
                    <Tooltip title={copiedField === 'remarks' ? 'Copied!' : 'Copy original text'}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopyToClipboard('remarks')}
                        sx={{
                          color: copiedField === 'remarks' ? DARK.success : DARK.textSecondary,
                          transition: 'all 0.3s ease',
                          '&:hover': { bgcolor: alpha(DARK.success, 0.1) }
                        }}
                      >
                        {copiedField === 'remarks' ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <CopyIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </Tooltip>
                  )}

                  {/* View Toggle - Only for admins in privacy mode */}
                  {canViewUnmasked && maskingEnabled && detectedSensitiveFields.remarks.length > 0 && (
                    <Tooltip title={showPassword ? 'Hide original' : 'Peek at original'}>
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword(!showPassword)}
                        sx={{
                          color: showPassword ? DARK.warning : DARK.textSecondary,
                          transition: 'all 0.3s ease',
                          '&:hover': { bgcolor: alpha(DARK.warning, 0.1) }
                        }}
                      >
                        {showPassword ? <VisibilityIcon sx={{ fontSize: 18 }} /> : <VisibilityOffIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>

              {/* Text Field with dual display for admins */}
              {canViewUnmasked && showPassword && maskingEnabled && detectedSensitiveFields.remarks.length > 0 ? (
                <Collapse in={true} timeout={200}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={userInput.remarks}
                    disabled
                    placeholder="Original unmasked text"
                    sx={{
                      ...textFieldSx,
                      mb: 1,
                      '& .MuiOutlinedInput-root': {
                        ...textFieldSx['& .MuiOutlinedInput-root'],
                        bgcolor: alpha(DARK.success, 0.05),
                        borderColor: DARK.success,
                      }
                    }}
                  />
                </Collapse>
              ) : null}

              <TextField
                fullWidth
                multiline
                rows={3}
                value={formData.remarks}
                onChange={handleRemarksChange}
                placeholder="Add any notes about this assignment..."
                disabled={loading}
                sx={textFieldSx}
              />

              {/* Detected Fields Badges */}
              {detectedSensitiveFields.remarks.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                  {detectedSensitiveFields.remarks.map(fieldType => (
                    <Chip
                      key={fieldType}
                      label={PrivacyMasking.MASKING_PATTERNS[fieldType]?.description}
                      size="small"
                      variant="outlined"
                      icon={maskingEnabled ? <ShieldIcon /> : <EditIcon />}
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        borderColor: maskingEnabled ? DARK.success : DARK.warning,
                        color: maskingEnabled ? DARK.success : DARK.warning,
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </DialogContent>

        {/* Actions */}
        <DialogActions sx={{
          p: 2,
          flexDirection: isMobile ? 'column' : 'row',
          gap: 1,
          bgcolor: isDarkMode ? DARK.surfaceAlt : 'transparent',
          borderTop: isDarkMode ? `1px solid ${DARK.border}` : 'none',
        }}>
          <Button
            fullWidth={isMobile}
            onClick={onClose}
            disabled={loading}
            color="inherit"
            sx={{ order: isMobile ? 2 : 1, color: isDarkMode ? DARK.textSecondary : 'inherit' }}
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
              '&:hover': { bgcolor: isDarkMode ? '#6D28D9' : undefined },
              '&.Mui-disabled': { bgcolor: isDarkMode ? 'rgba(124, 58, 237, 0.3)' : undefined },
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