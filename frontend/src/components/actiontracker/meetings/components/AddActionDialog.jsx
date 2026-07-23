// src/components/actiontracker/meetings/components/AddActionDialog.jsx

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, LinearProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  useMediaQuery, useTheme, IconButton, Typography,
  Stack, Box, Chip, Divider, FormHelperText,
  Checkbox, FormControlLabel, Autocomplete,
  alpha, Tooltip, Fade, Slide
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import FlagIcon from '@mui/icons-material/Flag';
import TagIcon from '@mui/icons-material/LocalOffer';
import TaskIcon from '@mui/icons-material/AssignmentTurnedIn';
import LightbulbIcon from '@mui/icons-material/LightbulbCircle';
import PersonIcon from '@mui/icons-material/Person';
import LinkIcon from '@mui/icons-material/Link';
import ChatBubbleOutlineIcon from '@mui/icons-material/Comment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import PersonsImplementingEditor from './PersonsImplementingEditor';
import { parsePersonsFromAction, buildPersonsPayload } from './personsImplementing';

// ==================== MASKING HELPERS ====================

// Helper function to mask phone numbers
const maskPhoneOnly = (text) => {
  if (!text) return '';
  
  // Match and mask phone numbers
  return text.replace(/(\+?\d{1,3}[-.\s]?)?(\d{2,3})[-.\s]?\d{3}[-.\s]?(\d{4})/g, (match, p1, p2, p3) => {
    const prefix = p1 ? p1 : '';
    return `${prefix}${p2 ? p2 : '***'}-***-${p3}`;
  });
};

// Helper function to mask email addresses
const maskEmail = (email) => {
  if (!email) return '';
  
  // Split email into local part and domain
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  
  // Mask the local part: show first 2 characters and last character, mask the rest
  let maskedLocal;
  if (localPart.length <= 3) {
    // For short emails, show first character and mask the rest
    maskedLocal = localPart.charAt(0) + '*'.repeat(localPart.length - 1);
  } else {
    // Show first 2 and last 1 character
    maskedLocal = localPart.substring(0, 2) + '*'.repeat(localPart.length - 3) + localPart.charAt(localPart.length - 1);
  }
  
  // Mask domain: show first 1-2 characters and last 1-2 characters
  const [domainName, tld] = domain.split('.');
  if (!tld) return `${maskedLocal}@${domain}`;
  
  let maskedDomain;
  if (domainName.length <= 3) {
    maskedDomain = domainName.charAt(0) + '*'.repeat(domainName.length - 1);
  } else {
    maskedDomain = domainName.substring(0, 2) + '*'.repeat(domainName.length - 3) + domainName.charAt(domainName.length - 1);
  }
  
  return `${maskedLocal}@${maskedDomain}.${tld}`;
};

// Helper function to mask both phone and email in a text
const maskContactInfo = (text) => {
  if (!text) return '';
  
  // First mask phone numbers
  let masked = maskPhoneOnly(text);
  // Then mask emails (email addresses don't contain spaces)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  masked = masked.replace(emailRegex, (match) => maskEmail(match));
  
  return masked;
};

// ==================== HELPERS ====================

const stripHtmlTags = (html) => {
  if (!html) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
};

const getPlainTextPreview = (html, maxLength = 100) => {
  const plainText = stripHtmlTags(html);
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength) + '...';
};

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

const isBeforeToday = (dateVal) => {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return false;
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

// ==================== RANDOM PLACEHOLDER GENERATORS ====================

const getRandomTitlePlaceholder = () => {
  const titles = [
    'Quarterly Budget Review',
    'Security Protocol Update',
    'Client Onboarding Process',
    'Inventory Reconciliation',
    'Staff Training Program',
    'Marketing Campaign Launch',
    'Compliance Audit Report',
    'IT Infrastructure Upgrade',
    'Vendor Contract Renewal',
    'Performance Review Cycle',
    'Project Milestone Delivery',
    'Risk Assessment Framework',
    'Product Roadmap Planning',
    'Customer Feedback Analysis',
    'Operational Efficiency Review',
    'Strategic Partnership Discussion',
    'Quality Assurance Process',
    'Data Migration Project',
    'Team Restructuring Plan',
    'Annual Financial Reporting'
  ];
  return titles[Math.floor(Math.random() * titles.length)];
};

const getRandomIssuePlaceholder = () => {
  const issues = [
    'Budget allocation needs review',
    'Security vulnerabilities detected',
    'Client satisfaction declining',
    'Inventory discrepancies found',
    'Team skill gaps identified',
    'ROI below target',
    'Compliance violations reported',
    'System performance issues',
    'Contract terms need renegotiation',
    'Employee retention concerns',
    'Project timeline at risk',
    'Risk exposure increasing',
    'Product-market fit question',
    'Customer churn rate rising',
    'Operational bottlenecks identified',
    'Partner alignment issues',
    'Quality standards slipping',
    'Data integrity concerns',
    'Team morale needs improvement',
    'Financial forecast accuracy'
  ];
  return issues[Math.floor(Math.random() * issues.length)];
};

const getRandomDescriptionPlaceholder = () => {
  const descriptions = [
    'Develop and implement a comprehensive strategy to address the identified challenges',
    'Create actionable deliverables with clear milestones and success criteria',
    'Establish a cross-functional team to drive this initiative forward',
    'Define and document standard operating procedures for this process',
    'Design and execute a phased implementation plan with stakeholder buy-in',
    'Conduct thorough analysis and provide recommendations for improvement',
    'Build and deploy a scalable solution that meets business requirements',
    'Develop training materials and conduct workshops for team members',
    'Create monitoring and reporting mechanisms to track progress',
    'Establish governance framework and accountability structures',
    'Design and implement quality assurance checkpoints throughout the process',
    'Develop communication plan to ensure stakeholder alignment',
    'Create risk mitigation strategies and contingency plans',
    'Build performance metrics dashboard for real-time tracking',
    'Establish feedback loops for continuous improvement',
    'Design and execute user acceptance testing protocols',
    'Create knowledge transfer documentation and handover plans',
    'Develop change management strategy for smooth adoption',
    'Build partnership framework and collaboration guidelines',
    'Establish escalation procedures and decision-making protocols'
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
};

const getRandomRemarksPlaceholder = () => {
  const remarks = [
    'Ensure stakeholder alignment before proceeding',
    'Requires executive approval by end of quarter',
    'Coordinate with legal team on compliance aspects',
    'Budget needs board approval',
    'Timeline dependent on external vendor availability',
    'Risk assessment required before implementation',
    'Cross-departmental collaboration essential',
    'Regular status updates to be provided weekly',
    'Escalation path defined for critical issues',
    'Success metrics to be tracked and reported',
    'Subject to change based on market conditions',
    'Pending regulatory review and approval',
    'Requires technical feasibility study',
    'Dependent on infrastructure readiness',
    'Stakeholder consultation in progress',
    'Implementation phased over multiple sprints',
    'Quality gates defined at each milestone',
    'Continuous feedback loop established',
    'Change management plan in development',
    'Training materials being prepared'
  ];
  return remarks[Math.floor(Math.random() * remarks.length)];
};

// ==================== CONSTANTS ====================

const TYPE_OF_ACTION_OPTIONS = [
  'Operational',
  'Strategic',
  'Administrative',
  'Financial',
  'Technical',
  'Compliance',
  'Other'
];

const PRIORITY_OPTIONS = [
  { value: 1, label: 'High - Urgent', emoji: '🔴' },
  { value: 2, label: 'Medium - Normal', emoji: '🟠' },
  { value: 3, label: 'Low - Flexible', emoji: '🟢' },
  { value: 4, label: 'Very Low - Info Only', emoji: '⚪' },
];

const EMPTY_ARRAY = [];

// ==================== LAYOUT PRIMITIVES ====================

const FlexRow = ({ children, gap = 2, wrap = true, ismobile = 'false', sx = {} }) => {
  const mobileBool = ismobile === 'true';
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: mobileBool ? 'column' : 'row',
      gap: mobileBool ? 2 : gap,
      width: '100%',
      flexWrap: wrap ? 'wrap' : 'nowrap',
      mb: 2.5,
      ...sx,
    }}>
      {children}
    </Box>
  );
};

const FlexItem = ({ children, flex = 1, minWidth = '0', ismobile = 'false', sx = {} }) => {
  const mobileBool = ismobile === 'true';
  return (
    <Box sx={{
      flex,
      minWidth,
      width: mobileBool ? '100%' : 'auto',
      ...sx,
    }}>
      {children}
    </Box>
  );
};

// ==================== MAIN COMPONENT ====================

const AddActionDialog = ({
  open,
  onClose,
  onSave,
  editingAction,
  meetingId,
  meetingName = null,
  minutes = EMPTY_ARRAY,
  meetingsList = EMPTY_ARRAY,
  tagSuggestions = EMPTY_ARRAY,
  selectedMinuteId = null,
  loading,
  error,
  busy = false,
  onMinutesCreated,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDarkMode = theme.palette.mode === 'dark';

  const colors = useMemo(() => ({
    bg: isDarkMode ? '#0B0B0D' : '#F8FAFC',
    surface: isDarkMode ? '#161618' : '#FFFFFF',
    border: isDarkMode ? 'rgba(255,255,255,0.06)' : '#E5E7EB',
    textPrimary: isDarkMode ? '#FFFFFF' : '#111827',
    textSecondary: isDarkMode ? '#9CA3AF' : '#6B7280',
    accent: isDarkMode ? '#A78BFA' : '#7C3AED',
    inputBg: isDarkMode ? '#1D1D20' : '#FFFFFF',
  }), [isDarkMode]);

  // Generate random placeholders when dialog opens
  const [placeholders, setPlaceholders] = useState({
    title: getRandomTitlePlaceholder(),
    issue: getRandomIssuePlaceholder(),
    description: getRandomDescriptionPlaceholder(),
    remarks: getRandomRemarksPlaceholder(),
  });

  // Regenerate placeholders when dialog opens or editing action changes
  useEffect(() => {
    if (open) {
      setPlaceholders({
        title: getRandomTitlePlaceholder(),
        issue: getRandomIssuePlaceholder(),
        description: getRandomDescriptionPlaceholder(),
        remarks: getRandomRemarksPlaceholder(),
      });
    }
  }, [open]);

  const [formData, setFormData] = useState({
    title: '',
    issue_challenge: '',
    description: '',
    is_key_action: false,
    type_of_action: '',
    persons_implementing: [],
    date_initiated: new Date(),
    due_date: null,
    priority: 2,
    tags: [],
    assign_to_meeting: null,
    remarks: '',
    minute_id: null
  });
  
  const [localError, setLocalError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasMinutes = minutes.length > 0;
  const maxInitiatedDate = useMemo(() => new Date(), [open]);

  const prevOpenRef = useRef(false);
  const prevEditingIdRef = useRef(undefined);

  // Function to mask persons data before passing to editor
  const maskPersonsData = useCallback((persons) => {
    if (!persons || !Array.isArray(persons)) return persons;
    
    return persons.map(person => ({
      ...person,
      // Mask email and phone in the person object if they exist
      email: person.email ? maskEmail(person.email) : person.email,
      phone: person.phone ? maskPhoneOnly(person.phone) : person.phone,
      // Also mask any other fields that might contain contact info
      contact_info: person.contact_info ? maskContactInfo(person.contact_info) : person.contact_info,
      // Keep the original values for internal use
      _originalEmail: person.email,
      _originalPhone: person.phone,
    }));
  }, []);

  // Reset form when dialog opens
  useEffect(() => {
    const editingId = editingAction?.id ?? null;
    const justOpened = open && !prevOpenRef.current;
    const editingTargetChanged = open && editingId !== prevEditingIdRef.current;

    if (justOpened || editingTargetChanged) {
      if (editingAction) {
        // Parse and mask persons implementing data
        const parsedPersons = parsePersonsFromAction(editingAction);
        const maskedPersons = maskPersonsData(parsedPersons);
        
        setFormData({
          title: editingAction.title || '',
          issue_challenge: editingAction.issue_challenge || '',
          description: editingAction.description || '',
          is_key_action: !!editingAction.is_key_action,
          type_of_action: editingAction.type_of_action || '',
          persons_implementing: maskedPersons,
          date_initiated: editingAction.date_initiated ? new Date(editingAction.date_initiated) : new Date(),
          due_date: editingAction.due_date ? new Date(editingAction.due_date) : null,
          priority: editingAction.priority || 2,
          tags: Array.isArray(editingAction.tags) ? editingAction.tags : [],
          assign_to_meeting: editingAction.assign_to_meeting_id
            ? (meetingsList.find(m => m.id === editingAction.assign_to_meeting_id) || null)
            : null,
          remarks: editingAction.remarks || '',
          minute_id: editingAction.minute_id || null
        });
      } else {
        setFormData({
          title: '',
          issue_challenge: '',
          description: '',
          is_key_action: false,
          type_of_action: '',
          persons_implementing: [],
          date_initiated: new Date(),
          due_date: null,
          priority: 2,
          tags: [],
          assign_to_meeting: null,
          remarks: '',
          minute_id: hasMinutes ? (selectedMinuteId || null) : null
        });
        // Refresh placeholders when creating new action
        setPlaceholders({
          title: getRandomTitlePlaceholder(),
          issue: getRandomIssuePlaceholder(),
          description: getRandomDescriptionPlaceholder(),
          remarks: getRandomRemarksPlaceholder(),
        });
      }
      setIsSubmitting(false);
      setLocalError(null);
    }

    prevOpenRef.current = open;
    prevEditingIdRef.current = editingId;
  }, [editingAction, open, selectedMinuteId, hasMinutes, meetingsList, maskPersonsData]);

  // ==================== HANDLERS ====================

  const handlePersonsChange = useCallback((persons) => {
    // Mask the data before storing in form state
    const maskedPersons = maskPersonsData(persons);
    setFormData(prev => ({ ...prev, persons_implementing: maskedPersons }));
  }, [maskPersonsData]);

  const handleSave = async () => {
    if (!formData.description.trim()) {
      setLocalError('Action description is required');
      return;
    }

    if (!editingAction && hasMinutes && !formData.minute_id) {
      setLocalError('Please select a minute to associate this action with');
      return;
    }

    if (formData.due_date && isBeforeToday(formData.due_date)) {
      setLocalError('Expected resolution date must be today or later');
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);

    // When building payload, use original unmasked data if available
    const personsPayload = buildPersonsPayload(formData.persons_implementing.map(person => ({
      ...person,
      // Use original values if they were masked
      email: person._originalEmail || person.email,
      phone: person._originalPhone || person.phone,
    })));

    const payload = {
      title: formData.title.trim() || null,
      issue_challenge: formData.issue_challenge || null,
      description: formData.description.trim(),
      is_key_action: formData.is_key_action,
      type_of_action: formData.type_of_action || null,
      date_initiated: formData.date_initiated ? formData.date_initiated.toISOString() : null,
      due_date: formData.due_date ? formData.due_date.toISOString() : null,
      priority: formData.priority,
      tags: formData.tags || [],
      assign_to_meeting_id: formData.assign_to_meeting?.id || null,
      remarks: formData.remarks || '',
      minute_id: formData.minute_id || null,
      meeting_id: meetingId,
      ...personsPayload
    };

    try {
      const result = await onSave(payload);
      if (result && result.minute_id && !formData.minute_id && !editingAction) {
        if (onMinutesCreated) {
          await onMinutesCreated(result.minute_id);
        }
      }
      onClose();
    } catch (err) {
      setLocalError(err?.message || 'Failed to create action');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMinute = useMemo(() => {
    if (!formData.minute_id) return null;
    return minutes.find((m) => m.id === formData.minute_id) || null;
  }, [formData.minute_id, minutes]);

  const isLoading = loading || busy || isSubmitting;

  const inputStyles = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 1.5,
      backgroundColor: colors.inputBg,
      '& fieldset': {
        borderColor: colors.border,
      },
      '&:hover fieldset': {
        borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#D1D5DB',
      },
      '&.Mui-focused fieldset': {
        borderColor: colors.accent,
        borderWidth: 2,
      },
    },
    '& .MuiInputLabel-root': {
      color: colors.textSecondary,
      '&.Mui-focused': {
        color: colors.accent,
      },
    },
    '& .MuiInputBase-input': {
      color: colors.textPrimary,
    },
  };

  // ==================== RENDER ====================

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
        slots={{ transition: Slide }}
        slotProps={{
          transition: { direction: isMobile ? 'up' : 'down' },
          paper: {
            sx: {
              borderRadius: isMobile ? 0 : 2.5,
              backgroundColor: colors.bg,
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
            }
          }
        }}
      >
        <DialogTitle sx={{
          p: { xs: 2, sm: 2.5 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
          width: '100%',
        }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{
              p: 0.75,
              borderRadius: 1.5,
              bgcolor: alpha(colors.accent, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {editingAction ? 
                <EditIcon sx={{ fontSize: 20, color: colors.accent }} /> : 
                <AddIcon sx={{ fontSize: 20, color: colors.accent }} />
              }
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {editingAction ? 'Edit Action' : 'New Action'}
              </Typography>
              {meetingName && (
                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                  {meetingName}
                </Typography>
              )}
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <Close sx={{ fontSize: 20, color: colors.textSecondary }} />
          </IconButton>
        </DialogTitle>

        {isLoading && <LinearProgress sx={{ height: 2, flexShrink: 0 }} />}

        <DialogContent sx={{ 
          p: { xs: 2, sm: 2.5 }, 
          overflowY: 'auto',
          flex: 1,
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {(localError || error) && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5, width: '100%' }} onClose={() => setLocalError(null)}>
              {localError || error}
            </Alert>
          )}

          {/* ===== ROW 1: TITLE (40%) + TYPE (60%) ===== */}
          <FlexRow gap={2} ismobile={isMobile ? 'true' : 'false'}>
            <FlexItem flex="0 0 40%" minWidth={isMobile ? '100%' : '200px'} ismobile={isMobile ? 'true' : 'false'}>
              <TextField
                fullWidth
                label="Title / Category"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={placeholders.title}
                disabled={isLoading}
                sx={inputStyles}
                size="small"
              />
            </FlexItem>
            <FlexItem flex="1" minWidth={isMobile ? '100%' : '250px'} ismobile={isMobile ? 'true' : 'false'}>
              <Autocomplete
                freeSolo
                fullWidth
                options={TYPE_OF_ACTION_OPTIONS}
                value={formData.type_of_action}
                onChange={(e, newValue) => setFormData({ ...formData, type_of_action: newValue || '' })}
                onInputChange={(e, newInputValue) => setFormData({ ...formData, type_of_action: newInputValue })}
                disabled={isLoading}
                sx={inputStyles}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Type" 
                    placeholder={isMobile ? "Select type" : "Operational, Strategic, Administrative, Financial, Technical, Compliance, Other"}
                    size="small"
                  />
                )}
              />
            </FlexItem>
          </FlexRow>

          {/* ===== ROW 2: PERSONS IMPLEMENTING - FULL WIDTH ===== */}
          <Box sx={{ mb: 2.5, width: '100%' }}>
            <PersonsImplementingEditor
              value={formData.persons_implementing}
              onChange={handlePersonsChange}
              disabled={isLoading}
              meetingId={meetingId}
            />
          </Box>

          {/* ===== ROW 3: MINUTE SELECTION - FULL WIDTH ===== */}
          {!editingAction && (
            <Box sx={{ mb: 2.5, width: '100%' }}>
              {!hasMinutes ? (
                <Alert
                  severity="info"
                  icon={<AutoAwesomeIcon />}
                  sx={{ 
                    borderRadius: 1.5,
                    backgroundColor: alpha(colors.accent, 0.06),
                    border: `1px solid ${alpha(colors.accent, 0.15)}`,
                    width: '100%',
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    No minutes available — a default minute will be created
                  </Typography>
                </Alert>
              ) : (
                <FormControl fullWidth required sx={inputStyles} size="small">
                  <InputLabel>Associated Minute *</InputLabel>
                  <Select
                    value={formData.minute_id || ''}
                    onChange={(e) => setFormData({ ...formData, minute_id: e.target.value })}
                    label="Associated Minute *"
                    disabled={isLoading}
                    size="small"
                  >
                    {minutes.map((minute) => (
                      <MenuItem key={minute.id} value={minute.id}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <DescriptionIcon sx={{ fontSize: 16, color: colors.textSecondary }} />
                          <Typography variant="body2">
                            {minute.topic || minute.title || 'Untitled Minute'}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                  {!formData.minute_id && hasMinutes && (
                    <FormHelperText error>Please select a minute</FormHelperText>
                  )}
                </FormControl>
              )}
            </Box>
          )}

          {editingAction && selectedMinute && (
            <Box sx={{ 
              mb: 2.5, 
              p: 1.5, 
              bgcolor: alpha(colors.accent, 0.04), 
              borderRadius: 1.5,
              border: `1px solid ${alpha(colors.accent, 0.1)}`,
              width: '100%',
            }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <DescriptionIcon sx={{ fontSize: 16, color: colors.textSecondary }} />
                <Typography variant="body2" fontWeight={500}>
                  {selectedMinute.topic || selectedMinute.title || 'Untitled Minute'}
                </Typography>
              </Stack>
            </Box>
          )}

          {/* ===== ROW 4: DESCRIPTION - FULL WIDTH ===== */}
          <Box sx={{ mb: 2.5, width: '100%' }}>
            <TextField
              fullWidth
              label="Action Description *"
              multiline
              rows={isMobile ? 2 : 3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={placeholders.description}
              disabled={isLoading}
              sx={inputStyles}
              error={!!localError && !formData.description.trim()}
              helperText={!!localError && !formData.description.trim() ? 'Required' : ''}
            />
          </Box>

          {/* ===== ROW 5: ISSUE - FULL WIDTH ===== */}
          <Box sx={{ mb: 2.5, width: '100%' }}>
            <TextField
              fullWidth
              label="Issue / Challenge"
              multiline
              rows={isMobile ? 1 : 2}
              value={formData.issue_challenge}
              onChange={(e) => setFormData({ ...formData, issue_challenge: e.target.value })}
              placeholder={placeholders.issue}
              disabled={isLoading}
              sx={inputStyles}
              size="small"
            />
          </Box>

          {/* ===== ROW 6: PRIORITY (50%) + DUE DATE (50%) ===== */}
          <FlexRow gap={2} ismobile={isMobile ? 'true' : 'false'}>
            <FlexItem flex="1" minWidth={isMobile ? '100%' : '150px'} ismobile={isMobile ? 'true' : 'false'}>
              <FormControl fullWidth size="small" sx={inputStyles}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  label="Priority"
                  disabled={isLoading}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography>{opt.emoji}</Typography>
                        <Typography variant="body2">{opt.label}</Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </FlexItem>
            <FlexItem flex="1" minWidth={isMobile ? '100%' : '150px'} ismobile={isMobile ? 'true' : 'false'}>
              <DatePicker
                label="Due Date"
                value={formData.due_date}
                onChange={(newValue) => setFormData({ ...formData, due_date: newValue })}
                disablePast
                disabled={isLoading}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                    sx: inputStyles,
                    placeholder: 'Select date',
                  }
                }}
              />
            </FlexItem>
          </FlexRow>

          {/* ===== ROW 7: KEY ACTION CHECKBOX - FULL WIDTH ===== */}
          <Box sx={{ mt: 2, width: '100%' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.is_key_action}
                  onChange={(e) => setFormData({ ...formData, is_key_action: e.target.checked })}
                  disabled={isLoading}
                  size="small"
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <LightbulbIcon sx={{ 
                    fontSize: 16, 
                    color: formData.is_key_action ? '#F59E0B' : colors.textSecondary 
                  }} />
                  <Typography variant="body2">
                    Key Critical Action
                  </Typography>
                </Stack>
              }
            />
          </Box>

          {/* ===== ROW 8: REMARKS - FULL WIDTH (Tags Hidden) ===== */}
          <Box sx={{ mt: 2, width: '100%' }}>
            <TextField
              fullWidth
              label="Remarks"
              multiline
              rows={isMobile ? 2 : 3}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder={placeholders.remarks}
              disabled={isLoading}
              sx={inputStyles}
              size="small"
            />
          </Box>
        </DialogContent>

        <Divider sx={{ borderColor: colors.border, flexShrink: 0 }} />

        <DialogActions sx={{
          p: { xs: 2, sm: 2.5 },
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1.5,
          flexShrink: 0,
          width: '100%',
          ...(isMobile && {
            flexDirection: 'column-reverse',
            gap: 1,
          })
        }}>
          <Button
            onClick={onClose}
            disabled={isLoading}
            variant="text"
            sx={{ 
              textTransform: 'none',
              fontWeight: 600,
              color: colors.textSecondary,
              ...(isMobile && { width: '100%' })
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isLoading || !formData.description.trim() || (hasMinutes && !formData.minute_id && !editingAction)}
            sx={{ 
              textTransform: 'none',
              fontWeight: 700,
              px: 4,
              py: 0.75,
              borderRadius: 1.5,
              bgcolor: colors.accent,
              '&:hover': {
                bgcolor: isDarkMode ? '#6D28D9' : '#6D28D9',
              },
              ...(isMobile && { width: '100%' })
            }}
          >
            {isLoading ? 'Saving...' : (editingAction ? 'Update' : 'Commit')}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AddActionDialog;