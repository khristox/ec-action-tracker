// src/components/actiontracker/meetings/components/AddActionDialog.jsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, LinearProgress, Alert,
  FormControl, InputLabel, Select, MenuItem,
  useMediaQuery, useTheme, IconButton, Typography,
  Stack, Box, Chip, Divider, FormHelperText,
  Checkbox, FormControlLabel, Autocomplete, Grid, Paper,
  alpha
} from '@mui/material';
import {
  Close,
  Description as DescriptionIcon,
  AccessTime as AccessTimeIcon,
  AutoAwesome as AutoAwesomeIcon,
  Warning as WarningIcon,
  EventAvailable as EventAvailableIcon,
  Flag as FlagIcon,
  LocalOffer as TagIcon,
  AssignmentTurnedIn as TaskIcon,
  LightbulbCircle as LightbulbIcon
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addMinutes, format } from 'date-fns';
import PersonsImplementingEditor from './PersonsImplementingEditor';
import { parsePersonsFromAction, buildPersonsPayload } from './personsImplementing';

// Helper function to strip HTML tags for preview
const stripHtmlTags = (html) => {
  if (!html) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
};

// Helper to get plain text preview
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
  { value: 1, label: 'High - Urgent', emoji: '🔴', color: '#EF4444' },
  { value: 2, label: 'Medium - Normal', emoji: '🟠', color: '#F59E0B' },
  { value: 3, label: 'Low - Flexible', emoji: '🟢', color: '#10B981' },
  { value: 4, label: 'Very Low - Info Only', emoji: '⚪', color: '#9CA3AF' },
];

const AddActionDialog = ({
  open,
  onClose,
  onSave,
  editingAction,
  meetingId,
  meetingName = null,
  minutes = [],
  meetingsList = [],
  tagSuggestions = [],
  selectedMinuteId = null,
  loading,
  error,
  busy = false,
  onMinutesCreated,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';

  // Elegant Theme Colors for Dark/Light alignment
  const colors = useMemo(() => ({
    bg: isDarkMode ? '#111827' : '#FFFFFF',
    surface: isDarkMode ? '#1F2937' : '#F9FAFB',
    cardBg: isDarkMode ? '#111827' : '#FFFFFF',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
    textSecondary: isDarkMode ? '#9CA3AF' : '#6B7280',
    primaryAlpha: isDarkMode ? 'rgba(124, 58, 237, 0.15)' : 'rgba(99, 102, 241, 0.08)',
    accent: isDarkMode ? '#A78BFA' : '#6366F1',
    inputBg: isDarkMode ? '#1F2937' : '#FFFFFF'
  }), [isDarkMode]);

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

  useEffect(() => {
    if (open) {
      if (editingAction) {
        setFormData({
          title: editingAction.title || '',
          issue_challenge: editingAction.issue_challenge || '',
          description: editingAction.description || '',
          is_key_action: !!editingAction.is_key_action,
          type_of_action: editingAction.type_of_action || '',
          persons_implementing: parsePersonsFromAction(editingAction),
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
      }
      setIsSubmitting(false);
      setLocalError(null);
    }
  }, [editingAction, open, selectedMinuteId, hasMinutes, meetingsList]);

  const handleSave = async () => {
    if (!formData.description.trim()) {
      setLocalError('Action is required');
      return;
    }

    if (!editingAction && hasMinutes && !formData.minute_id) {
      setLocalError('Please select a minute to associate this action with');
      return;
    }

    if (formData.due_date && isBeforeToday(formData.due_date)) {
      setLocalError('Expected date of resolution/closure must be today or later');
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);

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
      ...buildPersonsPayload(formData.persons_implementing)
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

  const getMinutePreview = (minute) => {
    if (minute.topic) return minute.topic;
    if (minute.title) return minute.title;
    if (minute.minute_text) return getPlainTextPreview(minute.minute_text, 80);
    if (minute.discussion) return getPlainTextPreview(minute.discussion, 80);
    return 'Untitled Minute';
  };

  const getActionCountDisplay = (minute) => {
    const count = minute.actions?.length || 0;
    if (count === 0) return 'No actions';
    return `${count} action${count !== 1 ? 's' : ''}`;
  };

  const getCompletionStatus = (minute) => {
    const actions = minute.actions || [];
    if (actions.length === 0) return null;
    const completed = actions.filter((a) => a.completed_at || a.overall_progress_percentage >= 100).length;
    return `${completed}/${actions.length} completed`;
  };

  const isLoading = loading || busy || isSubmitting;

  const inputGlobalStyles = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      backgroundColor: colors.inputBg,
      borderColor: colors.border
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
        slotProps={{
          paper: {
            sx: {
              borderRadius: isMobile ? 0 : 3,
              backgroundColor: colors.bg,
              backgroundImage: 'none',
              boxShadow: isDarkMode ? theme.shadows[16] : theme.shadows[8]
            }
          }
        }}
      >
        <DialogTitle sx={{
          m: 0,
          p: 2.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: isDarkMode ? colors.surface : alpha(theme.palette.primary.main, 0.03),
          borderBottom: `1px solid ${colors.border}`,
          color: 'text.primary'
        }}>
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>
              {editingAction ? 'Edit Action Item' : 'New Action Item'}
            </Typography>
            {meetingName && (
              <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', mt: 0.25 }}>
                Meeting: {meetingName}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }} aria-label="Close dialog">
            <Close />
          </IconButton>
        </DialogTitle>

        {isLoading && <LinearProgress color="primary" sx={{ height: 3 }} />}

        <DialogContent sx={{ p: { xs: 2, md: 3 }, backgroundColor: colors.bg }}>
          {(localError || error) && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setLocalError(null)}>
              {localError || error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* ---------------- LEFT COLUMN ---------------- */}
            <Grid item xs={12} md={6}>
              <Stack spacing={3}>
                <Typography variant="subtitle2" color="primary" fontWeight={700} sx={{ letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                  Context & Details
                </Typography>

                {!editingAction && (
                  <>
                    {!hasMinutes ? (
                      <Alert
                        severity="info"
                        sx={{
                          borderRadius: 2.5,
                          backgroundColor: colors.primaryAlpha,
                          border: `1px solid ${alpha(colors.accent, 0.2)}`,
                          '& .MuiAlert-icon': { alignSelf: 'center', color: colors.accent }
                        }}
                        icon={<AutoAwesomeIcon />}
                      >
                        <Typography variant="body2" fontWeight={700} color="text.primary" gutterBottom>
                          No minutes available
                        </Typography>
                        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                          A default minute context layer will be safely provisioned automatically upon saving this action tree.
                        </Typography>
                      </Alert>
                    ) : (
                      <FormControl fullWidth required sx={inputGlobalStyles}>
                        <InputLabel>Associated Minute *</InputLabel>
                        <Select
                          value={formData.minute_id || ''}
                          onChange={(e) => setFormData({ ...formData, minute_id: e.target.value })}
                          label="Associated Minute *"
                          disabled={isLoading}
                          renderValue={(selected) => {
                            const minute = minutes.find((m) => m.id === selected);
                            if (!minute) return 'Select a minute';
                            return (
                              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                <DescriptionIcon fontSize="small" sx={{ color: colors.accent }} />
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" fontWeight={600} noWrap>
                                    {getMinutePreview(minute)}
                                  </Typography>
                                </Box>
                              </Stack>
                            );
                          }}
                          MenuProps={{ PaperProps: { style: { maxHeight: 400 } } }}
                        >
                          {minutes.map((minute) => {
                            const actionCount = minute.actions?.length || 0;
                            const completionStatus = getCompletionStatus(minute);
                            const discussionPreview = getPlainTextPreview(minute.discussion, 120);

                            return (
                              <MenuItem key={minute.id} value={minute.id} sx={{ py: 1.5, borderBottom: `1px solid ${colors.border}` }}>
                                <Stack spacing={0.5} sx={{ width: '100%' }}>
                                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                                    <DescriptionIcon fontSize="small" sx={{ color: colors.accent }} />
                                    <Typography variant="subtitle2" fontWeight={700}>
                                      {minute.topic || minute.title || 'Untitled Minute'}
                                    </Typography>
                                  </Stack>

                                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', ml: 4, flexWrap: 'wrap', gap: 0.5 }}>
                                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                                      {safeFormatDate(minute.created_at)}
                                    </Typography>
                                    <Chip label={getActionCountDisplay(minute)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                    {completionStatus && (
                                      <Chip label={completionStatus} size="small" color="success" variant="alpha" sx={{ height: 20, fontSize: '0.7rem' }} />
                                    )}
                                  </Stack>
                                  {discussionPreview && (
                                    <Typography variant="caption" sx={{ ml: 4, color: colors.textSecondary }} noWrap>
                                      {discussionPreview}
                                    </Typography>
                                  )}
                                </Stack>
                              </MenuItem>
                            );
                          })}
                        </Select>
                        {!formData.minute_id && hasMinutes && (
                          <FormHelperText error>Please select a minute to associate this action with</FormHelperText>
                        )}
                      </FormControl>
                    )}
                  </>
                )}

                {editingAction && selectedMinute && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: colors.surface, borderRadius: 2.5, borderColor: colors.border }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                      <DescriptionIcon fontSize="small" sx={{ color: colors.accent }} />
                      <Typography variant="caption" fontWeight={700} color="text.secondary">ASSOCIATED MINUTE</Typography>
                    </Stack>
                    <Box sx={{ ml: 4 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {selectedMinute.topic || selectedMinute.title || 'Untitled Minute'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', mt: 0.5 }}>
                        Created: {safeFormatDate(selectedMinute.created_at)} · {selectedMinute.actions?.length || 0} actions
                      </Typography>
                    </Box>
                  </Paper>
                )}

                <TextField
                  fullWidth
                  label="Title / Category"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Financial Audit Mitigation"
                  disabled={isLoading}
                  sx={inputGlobalStyles}
                />

                <TextField
                  fullWidth
                  label="Issue / Challenge"
                  multiline
                  rows={2}
                  value={formData.issue_challenge}
                  onChange={(e) => setFormData({ ...formData, issue_challenge: e.target.value })}
                  placeholder="Describe the problem context triggering this resolution track..."
                  disabled={isLoading}
                  sx={inputGlobalStyles}
                />

                <TextField
                  fullWidth
                  label="Action Description *"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  placeholder="Define clear deliverables and operational step tracks..."
                  disabled={isLoading}
                  error={!!localError && !formData.description.trim()}
                  helperText={!!localError && !formData.description.trim() ? 'Action specification is required' : ''}
                  sx={inputGlobalStyles}
                />

                <Box sx={{ p: 1.5, bgcolor: colors.surface, borderRadius: 2, border: `1px dashed ${colors.border}` }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.is_key_action}
                        onChange={(e) => setFormData({ ...formData, is_key_action: e.target.checked })}
                        disabled={isLoading}
                        color="primary"
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <LightbulbIcon sx={{ fontSize: 18, color: formData.is_key_action ? '#F59E0B' : colors.textSecondary }} />
                        <Typography variant="body2" fontWeight={formData.is_key_action ? 700 : 500}>
                          Flag as Key Critical Action
                        </Typography>
                      </Stack>
                    }
                  />
                </Box>
              </Stack>
            </Grid>

            {/* ---------------- RIGHT COLUMN ---------------- */}
            <Grid item xs={12} md={6}>
              <Stack spacing={3}>
                <Typography variant="subtitle2" color="primary" fontWeight={700} sx={{ letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                  Execution Trackers
                </Typography>

                <PersonsImplementingEditor
                  value={formData.persons_implementing}
                  onChange={(persons) => setFormData((fd) => ({ ...fd, persons_implementing: persons }))}
                  disabled={isLoading}
                  meetingId={meetingId}
                />

                <Autocomplete
                  freeSolo
                  fullWidth
                  options={TYPE_OF_ACTION_OPTIONS}
                  value={formData.type_of_action}
                  onChange={(e, newValue) => setFormData({ ...formData, type_of_action: newValue || '' })}
                  onInputChange={(e, newInputValue) => setFormData({ ...formData, type_of_action: newInputValue })}
                  disabled={isLoading}
                  sx={inputGlobalStyles}
                  renderInput={(params) => (
                    <TextField {...params} label="Type of Action" placeholder="e.g. Operational" />
                  )}
                />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label="Date Initiated"
                      value={formData.date_initiated}
                      onChange={(newValue) => setFormData({ ...formData, date_initiated: newValue })}
                      disableFuture
                      maxDate={maxInitiatedDate}
                      disabled={isLoading}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          disabled: isLoading,
                          sx: inputGlobalStyles,
                          InputProps: { startAdornment: <EventAvailableIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} /> }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label="Expected Resolution Date"
                      value={formData.due_date}
                      onChange={(newValue) => setFormData({ ...formData, due_date: newValue })}
                      disablePast
                      disabled={isLoading}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          sx: inputGlobalStyles,
                          helperText: 'Today or target future date'
                        }
                      }}
                    />
                  </Grid>
                </Grid>

                <FormControl fullWidth disabled={isLoading} sx={inputGlobalStyles}>
                  <InputLabel>Priority Level</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    label="Priority Level"
                    startAdornment={<FlagIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} />}
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{opt.emoji}</Typography>
                          <Typography variant="body2" fontWeight={formData.priority === opt.value ? 700 : 500}>
                            {opt.label}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Autocomplete
                  multiple
                  freeSolo
                  fullWidth
                  options={tagSuggestions}
                  value={formData.tags}
                  onChange={(e, newValue) => setFormData({ ...formData, tags: newValue })}
                  disabled={isLoading}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip variant="outlined" size="small" label={option} {...getTagProps({ index })} sx={{ borderRadius: 1.5, fontWeight: 600 }} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tags"
                      placeholder="Press enter to add"
                      sx={inputGlobalStyles}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <TagIcon fontSize="small" sx={{ ml: 0.5, mr: 0.5, color: 'action.active' }} />
                            {params.InputProps?.startAdornment}
                          </>
                        )
                      }}
                    />
                  )}
                />

                <Autocomplete
                  fullWidth
                  options={meetingsList}
                  getOptionLabel={(option) => option?.name || option?.title || ''}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={formData.assign_to_meeting}
                  onChange={(e, newValue) => setFormData({ ...formData, assign_to_meeting: newValue })}
                  disabled={isLoading}
                  sx={inputGlobalStyles}
                  renderInput={(params) => (
                    <TextField {...params} label="Assign Action to Cross-Meeting" placeholder="Optional sync track link" />
                  )}
                />

                <TextField
                  fullWidth
                  label="Remarks / Processing Notes"
                  multiline
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Any extra execution details or management constraints..."
                  disabled={isLoading}
                  sx={inputGlobalStyles}
                />
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>

        <Divider sx={{ borderColor: colors.border }} />

        <DialogActions sx={{
          p: 2.5,
          bgcolor: isDarkMode ? colors.surface : alpha(theme.palette.primary.main, 0.02),
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 1.5,
          width: '100%',
          boxSizing: 'border-box',
          ...(isMobile && {
            flexDirection: 'column',
            alignItems: 'stretch',
          })
        }}>
          {isMobile ? (
            <>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSave}
                disabled={isLoading || !formData.description.trim() || (hasMinutes && !formData.minute_id)}
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  boxShadow: theme.shadows[2],
                  py: 1.5
                }}
                startIcon={!hasMinutes && !editingAction ? <AutoAwesomeIcon /> : <TaskIcon />}
              >
                {isLoading
                  ? (busy ? 'Provisioning context...' : 'Saving updates...')
                  : editingAction
                    ? 'Update Action'
                    : (!hasMinutes ? 'Create Action & Context' : 'Commit Action')}
              </Button>
              
              <Button
                fullWidth
                onClick={onClose}
                disabled={isLoading}
                variant="outlined"
                color="inherit"
                sx={{ 
                  borderRadius: 2, 
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 1
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={onClose}
                disabled={isLoading}
                variant="outlined"
                color="inherit"
                sx={{ 
                  borderRadius: 2, 
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  py: 1
                }}
              >
                Cancel
              </Button>

              <Button
                variant="contained"
                onClick={handleSave}
                disabled={isLoading || !formData.description.trim() || (hasMinutes && !formData.minute_id)}
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  boxShadow: theme.shadows[2],
                  px: 3,
                  py: 1
                }}
                startIcon={!hasMinutes && !editingAction ? <AutoAwesomeIcon /> : <TaskIcon />}
              >
                {isLoading
                  ? (busy ? 'Provisioning context...' : 'Saving updates...')
                  : editingAction
                    ? 'Update Action'
                    : (!hasMinutes ? 'Create Action & Context' : 'Commit Action')}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AddActionDialog;