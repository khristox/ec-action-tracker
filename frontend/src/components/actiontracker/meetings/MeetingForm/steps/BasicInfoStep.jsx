// src/components/meetings/MeetingForm/steps/BasicInfoStep.jsx

import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
  Paper,
  Stack,
  Chip,
  InputAdornment,
  IconButton,
  Tooltip,
  Fade,
  alpha,
  useTheme,
  Skeleton,
  Alert,
  Divider,
} from '@mui/material';
import {
  Title as TitleIcon,
  Description as DescriptionIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  Business as BusinessIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  People as PeopleIcon,
  Clear as ClearIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { format, isValid, parseISO } from 'date-fns';
import { VisibilitySelector } from '../components/VisibilitySelector';
import { DepartmentSelector } from '../components/DepartmentSelector';

// ============================================================================
// Constants
// ============================================================================

const FIELD_REQUIREMENTS = {
  title: { required: true, minLength: 3, maxLength: 200 },
  meeting_date: { required: true },
  start_time: { required: true },
  end_time: { required: false },
};

const VALIDATION_MESSAGES = {
  title: {
    required: 'Meeting title is required',
    minLength: 'Title must be at least 3 characters',
    maxLength: 'Title cannot exceed 200 characters',
  },
  meeting_date: {
    required: 'Meeting date is required',
    invalid: 'Please enter a valid date',
  },
  start_time: {
    required: 'Start time is required',
    invalid: 'Please enter a valid time',
  },
  end_time: {
    invalid: 'Please enter a valid time',
    beforeStart: 'End time must be after start time',
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

const SectionHeader = ({ icon: Icon, title, status, statusText }) => (
  <Typography
    variant="subtitle2"
    fontWeight={600}
    sx={{
      color: (theme) => theme.palette.mode === 'light' ? '#1a1a2e' : '#ffffff',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    }}
  >
    <Icon sx={{ fontSize: 18, color: '#667eea' }} />
    {title}
    {status && (
      <Chip
        label={statusText || '✓ Complete'}
        size="small"
        color={status === 'complete' ? 'success' : 'default'}
        variant={status === 'complete' ? 'filled' : 'outlined'}
        sx={{ height: 20, fontSize: '0.65rem' }}
      />
    )}
  </Typography>
);

const SectionPaper = ({ children, ...props }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        bgcolor: isLight
          ? alpha(theme.palette.primary.main, 0.02)
          : alpha(theme.palette.primary.main, 0.04),
        border: '1px solid',
        borderColor: isLight
          ? alpha(theme.palette.primary.main, 0.08)
          : alpha(theme.palette.primary.main, 0.1),
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: isLight
            ? alpha(theme.palette.primary.main, 0.15)
            : alpha(theme.palette.primary.main, 0.2),
        },
        ...props.sx,
      }}
    >
      {children}
    </Paper>
  );
};

const FormTextField = ({ 
  icon: Icon, 
  required = false, 
  error = false, 
  helperText = '',
  success = false,
  ...props 
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <TextField
      required={required}
      fullWidth
      size="small"
      error={error}
      helperText={helperText}
      sx={{
        '& .MuiOutlinedInput-root': {
          bgcolor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.05)',
          '&:hover': {
            bgcolor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.08)',
          },
          '&.Mui-focused': {
            bgcolor: isLight ? '#ffffff' : 'rgba(255,255,255,0.1)',
          },
        },
        ...props.sx,
      }}
      slotProps={{
        input: {
          startAdornment: Icon && (
            <InputAdornment position="start">
              <Icon sx={{ fontSize: 20, color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: success && (
            <InputAdornment position="end">
              <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
            </InputAdornment>
          ),
          ...props.slotProps?.input,
        },
        ...props.slotProps,
      }}
      {...props}
    />
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const BasicInfoStep = memo(({
  // Form Data
  formData,
  setFormData,
  
  // Visibility
  visibility,
  setVisibility,
  
  // Department
  restrictedDepartmentId,
  restrictedDepartmentName,
  handleRestrictedDepartmentChange,
  handleClearRestrictedDepartment,
  
  // Organization
  organizationId,
  setOrganizationId,
  
  // UI State
  isMobile = false,
  apiLoading = false,
  isSubmitting = false,
  
  // Event Handlers
  handleChange,
  handleDateChange,
  handleStartTimeChange,
  handleEndTimeChange,
  
  // Validation
  errors = {},
  touched = {},
  
  // Callbacks
  onFieldTouch,
  onValidationChange,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const isRestricted = visibility === 'department';

  // ==========================================================================
  // Local State
  // ==========================================================================

  const [localErrors, setLocalErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});

  // ==========================================================================
  // Memoized Values
  // ==========================================================================

  const isTitleFilled = useMemo(
    () => formData?.title?.trim()?.length > 0,
    [formData?.title]
  );

  const isDateFilled = useMemo(
    () => !!formData?.meeting_date,
    [formData?.meeting_date]
  );

  const isStartTimeFilled = useMemo(
    () => !!formData?.start_time,
    [formData?.start_time]
  );

  const isEndTimeFilled = useMemo(
    () => !!formData?.end_time,
    [formData?.end_time]
  );

  const isScheduleComplete = useMemo(
    () => isDateFilled && isStartTimeFilled,
    [isDateFilled, isStartTimeFilled]
  );

  const isFormValid = useMemo(() => {
    // Check required fields
    if (!isTitleFilled) return false;
    if (!isDateFilled) return false;
    if (!isStartTimeFilled) return false;
    
    // Check title length
    if (formData?.title?.length < 3) return false;
    if (formData?.title?.length > 200) return false;
    
    // Check time validation
    if (formData?.start_time && formData?.end_time) {
      const start = new Date(formData.start_time);
      const end = new Date(formData.end_time);
      if (end <= start) return false;
    }
    
    return true;
  }, [formData, isTitleFilled, isDateFilled, isStartTimeFilled]);

  // ==========================================================================
  // Callbacks
  // ==========================================================================

  const handleFieldTouch = useCallback((fieldName) => {
    setFieldTouched(prev => ({ ...prev, [fieldName]: true }));
    if (onFieldTouch) {
      onFieldTouch(fieldName);
    }
  }, [onFieldTouch]);

  const validateField = useCallback((fieldName, value) => {
    const requirements = FIELD_REQUIREMENTS[fieldName];
    if (!requirements) return null;

    if (requirements.required && !value) {
      return VALIDATION_MESSAGES[fieldName]?.required || 'This field is required';
    }

    if (fieldName === 'title' && value) {
      if (value.length < requirements.minLength) {
        return VALIDATION_MESSAGES.title.minLength;
      }
      if (value.length > requirements.maxLength) {
        return VALIDATION_MESSAGES.title.maxLength;
      }
    }

    if (fieldName === 'meeting_date' && value) {
      const date = new Date(value);
      if (!isValid(date)) {
        return VALIDATION_MESSAGES.meeting_date.invalid;
      }
    }

    return null;
  }, []);

  const handleFieldChange = useCallback((fieldName) => (event) => {
    const value = event?.target?.value || event;
    
    // Update form data
    if (handleChange) {
      handleChange(event);
    } else {
      setFormData(prev => ({
        ...prev,
        [fieldName]: value,
      }));
    }

    // Mark as touched
    handleFieldTouch(fieldName);

    // Validate
    const error = validateField(fieldName, value);
    setLocalErrors(prev => ({
      ...prev,
      [fieldName]: error,
    }));

    // Notify parent of validation change
    if (onValidationChange) {
      onValidationChange(fieldName, !error);
    }
  }, [handleChange, setFormData, handleFieldTouch, validateField, onValidationChange]);

  // ==========================================================================
  // Formatted Values for Display
  // ==========================================================================

  const formatDateTime = useCallback((date, time) => {
    if (!date || !time) return '';
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      const timeObj = typeof time === 'string' ? parseISO(time) : time;
      
      if (!isValid(dateObj) || !isValid(timeObj)) return '';
      
      const combined = new Date(dateObj);
      combined.setHours(timeObj.getHours(), timeObj.getMinutes());
      
      return format(combined, 'PPP p');
    } catch {
      return '';
    }
  }, []);

  const getScheduleDisplay = useMemo(() => {
    if (!isDateFilled || !isStartTimeFilled) return null;
    
    const dateStr = formData.meeting_date;
    const startStr = formData.start_time;
    const endStr = formData.end_time;
    
    try {
      const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
      const start = typeof startStr === 'string' ? parseISO(startStr) : startStr;
      
      if (!isValid(date) || !isValid(start)) return null;
      
      const startDisplay = format(start, 'p');
      const endDisplay = endStr ? format(
        typeof endStr === 'string' ? parseISO(endStr) : endStr, 
        'p'
      ) : null;
      
      return {
        date: format(date, 'PPP'),
        startTime: startDisplay,
        endTime: endDisplay,
        full: `${format(date, 'PPP')} at ${startDisplay}${endDisplay ? ` - ${endDisplay}` : ''}`,
      };
    } catch {
      return null;
    }
  }, [formData.meeting_date, formData.start_time, formData.end_time, isDateFilled, isStartTimeFilled]);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (apiLoading && !formData) {
    return (
      <Box sx={{ width: '100%', p: 2 }}>
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={100} />
          <Skeleton variant="rounded" height={80} />
          <Skeleton variant="rounded" height={120} />
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Stack spacing={2.5}>
        {/* ============================================
             Meeting Details Section
             ============================================ */}
        <SectionPaper>
          <Stack spacing={2}>
            <SectionHeader
              icon={TitleIcon}
              title="Meeting Details"
              status={isTitleFilled ? 'complete' : null}
              statusText={isTitleFilled ? '✓ Title set' : undefined}
            />

            <FormTextField
              required
              label="Meeting Title *"
              name="title"
              value={formData?.title || ''}
              onChange={handleFieldChange('title')}
              onBlur={() => handleFieldTouch('title')}
              placeholder="Enter a clear, descriptive meeting title"
              icon={TitleIcon}
              success={isTitleFilled}
              error={!!(localErrors.title || errors.title)}
              helperText={localErrors.title || errors.title || `Min 3, Max 200 characters (${formData?.title?.length || 0}/200)`}
              disabled={apiLoading || isSubmitting}
              inputProps={{
                maxLength: 200,
                'aria-label': 'Meeting title',
              }}
            />

            <FormTextField
              label="Description (Optional)"
              name="description"
              value={formData?.description || ''}
              onChange={handleFieldChange('description')}
              onBlur={() => handleFieldTouch('description')}
              placeholder="Add context, objectives, or background information for this meeting"
              multiline
              rows={2}
              icon={DescriptionIcon}
              disabled={apiLoading || isSubmitting}
              inputProps={{
                maxLength: 1000,
                'aria-label': 'Meeting description',
              }}
            />
          </Stack>
        </SectionPaper>

        {/* ============================================
             Schedule Section
             ============================================ */}
        <SectionPaper>
          <Stack spacing={2}>
            <SectionHeader
              icon={EventIcon}
              title="Schedule"
              status={isScheduleComplete ? 'complete' : null}
              statusText={isScheduleComplete ? '✓ Scheduled' : undefined}
            />

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="Meeting Date *"
                  value={formData?.meeting_date || null}
                  onChange={handleDateChange}
                  disabled={apiLoading || isSubmitting}
                  slotProps={{
                    textField: {
                      required: true,
                      size: 'small',
                      error: !!(localErrors.meeting_date || errors.meeting_date),
                      helperText: localErrors.meeting_date || errors.meeting_date,
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          bgcolor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.05)',
                          '&:hover': {
                            bgcolor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.08)',
                          },
                          '&.Mui-focused': {
                            bgcolor: isLight ? '#ffffff' : 'rgba(255,255,255,0.1)',
                          },
                        },
                      },
                      slotProps: {
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <EventIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                        },
                      },
                    },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TimePicker
                  label="Start Time *"
                  value={formData?.start_time || null}
                  onChange={handleStartTimeChange}
                  disabled={apiLoading || isSubmitting}
                  slotProps={{
                    textField: {
                      required: true,
                      size: 'small',
                      error: !!(localErrors.start_time || errors.start_time),
                      helperText: localErrors.start_time || errors.start_time,
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          bgcolor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.05)',
                          '&:hover': {
                            bgcolor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.08)',
                          },
                          '&.Mui-focused': {
                            bgcolor: isLight ? '#ffffff' : 'rgba(255,255,255,0.1)',
                          },
                        },
                      },
                      slotProps: {
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                        },
                      },
                    },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TimePicker
                  label="End Time"
                  value={formData?.end_time || null}
                  onChange={handleEndTimeChange}
                  disabled={apiLoading || isSubmitting}
                  slotProps={{
                    textField: {
                      size: 'small',
                      error: !!(localErrors.end_time || errors.end_time),
                      helperText: localErrors.end_time || errors.end_time,
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          bgcolor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.05)',
                          '&:hover': {
                            bgcolor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.08)',
                          },
                          '&.Mui-focused': {
                            bgcolor: isLight ? '#ffffff' : 'rgba(255,255,255,0.1)',
                          },
                        },
                      },
                      slotProps: {
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                        },
                      },
                    },
                  }}
                />
              </Grid>
            </Grid>

            {/* Schedule Summary */}
            {getScheduleDisplay && (
              <Fade in timeout={400}>
                <Alert
                  icon={<ScheduleIcon />}
                  severity="success"
                  sx={{
                    mt: 1,
                    '& .MuiAlert-message': {
                      width: '100%',
                    },
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Typography variant="body2">
                      <strong>Meeting scheduled for:</strong>
                    </Typography>
                    <Typography variant="body2">
                      {getScheduleDisplay.full}
                    </Typography>
                  </Stack>
                </Alert>
              </Fade>
            )}

            {/* Time Validation Warning */}
            {formData?.start_time && formData?.end_time && (
              new Date(formData.end_time) <= new Date(formData.start_time) && (
                <Alert severity="error" icon={<WarningIcon />}>
                  End time must be after start time
                </Alert>
              )
            )}
          </Stack>
        </SectionPaper>

        {/* ============================================
             Access Control Section
             ============================================ */}
        <SectionPaper
          sx={{
            bgcolor: isRestricted
              ? (isLight ? alpha(theme.palette.warning.main, 0.04) : alpha(theme.palette.warning.main, 0.08))
              : undefined,
            borderColor: isRestricted
              ? (isLight ? alpha(theme.palette.warning.main, 0.2) : alpha(theme.palette.warning.main, 0.3))
              : undefined,
          }}
        >
          <Stack spacing={2}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <BusinessIcon
                  sx={{
                    fontSize: 18,
                    color: isRestricted
                      ? 'warning.main'
                      : (isLight ? '#6b6b8a' : '#888888'),
                  }}
                />
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{
                    color: isRestricted
                      ? (isLight ? 'warning.dark' : 'warning.light')
                      : (isLight ? '#1a1a2e' : '#ffffff'),
                  }}
                >
                  Department Access Control
                </Typography>
              </Stack>
              {isRestricted && (
                <Chip
                  label="Restricted"
                  size="small"
                  color="warning"
                  icon={<LockIcon sx={{ fontSize: 12 }} />}
                  onDelete={handleClearRestrictedDepartment}
                  sx={{ height: 22 }}
                />
              )}
            </Stack>

            <VisibilitySelector
              value={visibility}
              onChange={setVisibility}
              disabled={apiLoading || isSubmitting}
              isLight={isLight}
            />

            {isRestricted && (
              <Fade in timeout={300}>
                <Box>
                  <DepartmentSelector
                    value={restrictedDepartmentId}
                    onChange={handleRestrictedDepartmentChange}
                    disabled={apiLoading || isSubmitting}
                    isLight={isLight}
                  />
                </Box>
              </Fade>
            )}

            <Stack
              direction="row"
              spacing={1}
              alignItems="flex-start"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: isRestricted
                  ? (isLight ? alpha(theme.palette.warning.main, 0.04) : alpha(theme.palette.warning.main, 0.08))
                  : (isLight ? alpha(theme.palette.info.main, 0.04) : alpha(theme.palette.info.main, 0.08)),
                border: '1px solid',
                borderColor: isRestricted
                  ? (isLight ? alpha(theme.palette.warning.main, 0.1) : alpha(theme.palette.warning.main, 0.15))
                  : (isLight ? alpha(theme.palette.info.main, 0.1) : alpha(theme.palette.info.main, 0.15)),
              }}
            >
              <InfoIcon
                sx={{
                  fontSize: 16,
                  color: isRestricted ? 'warning.main' : 'info.main',
                  mt: 0.25,
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: isLight ? '#4a4a6a' : '#aaaaaa' }}
              >
                {isRestricted
                  ? '🔒 This meeting will be visible only to members of the selected department.'
                  : '🌐 This meeting will be open to all departments. Select "Restricted to Department" to limit access.'
                }
              </Typography>
            </Stack>
          </Stack>
        </SectionPaper>

        {/* ============================================
             Validation Summary
             ============================================ */}
        {!isFormValid && Object.keys(touched).length > 0 && (
          <Alert severity="info" icon={<InfoIcon />}>
            Please fill in all required fields to continue:
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
              {!isTitleFilled && <li>Meeting title is required</li>}
              {!isDateFilled && <li>Meeting date is required</li>}
              {!isStartTimeFilled && <li>Start time is required</li>}
              {formData?.title?.length < 3 && formData?.title?.length > 0 && (
                <li>Title must be at least 3 characters</li>
              )}
              {formData?.start_time && formData?.end_time && 
               new Date(formData.end_time) <= new Date(formData.start_time) && (
                <li>End time must be after start time</li>
              )}
            </ul>
          </Alert>
        )}

        {/* ============================================
             Hidden Form Data (for form submission)
             ============================================ */}
        <input type="hidden" name="organizationId" value={organizationId} />
      </Stack>
    </Box>
  );
});

// ============================================================================
// Display Name for Debugging
// ============================================================================

BasicInfoStep.displayName = 'BasicInfoStep';

export default BasicInfoStep;