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
  Fade,
  alpha,
  useTheme,
  Skeleton,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Title as TitleIcon,
  Description as DescriptionIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { format, isValid, parseISO } from 'date-fns';

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
// Helper Functions - UTC Date Handling
// ============================================================================

const safeParseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }
    try {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch {
      // Ignore
    }
  }
  return null;
};

const safeParseTime = (value) => {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string') {
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      const [hours, minutes, seconds = '00'] = value.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, seconds, 0);
      return date;
    }
    try {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch {
      // Ignore
    }
  }
  return null;
};

// ============================================================================
// Sub-Components - COMPACT versions with minimal padding
// ============================================================================

const SectionHeader = memo(({ icon: Icon, title, status, statusText, tooltip }) => (
  <Typography
    variant="subtitle2"
    fontWeight={600}
    sx={{
      color: (theme) => theme.palette.mode === 'light' ? '#1a1a2e' : '#ffffff',
      display: 'flex',
      alignItems: 'center',
      gap: 0.75,
      fontSize: '0.8rem',
    }}
  >
    <Icon sx={{ fontSize: 16, color: '#667eea' }} />
    {title}
    {tooltip && (
      <Tooltip title={tooltip} arrow>
        <IconButton size="small" sx={{ p: 0 }}>
          <HelpIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
        </IconButton>
      </Tooltip>
    )}
    {status && (
      <Chip
        label={statusText || '✓ Complete'}
        size="small"
        color={status === 'complete' ? 'success' : 'default'}
        variant={status === 'complete' ? 'filled' : 'outlined'}
        sx={{ height: 18, fontSize: '0.55rem', '& .MuiChip-label': { px: 0.75 } }}
      />
    )}
  </Typography>
));

SectionHeader.displayName = 'SectionHeader';

// COMPACT SectionPaper - minimal padding
const SectionPaper = ({ children, ...props }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1, sm: 1.25 },
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

// FormTextField - size is "small" by default but can be overridden per-usage
// via the `size` prop, since `{...props}` is spread after the default below.
const FormTextField = memo(({ 
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
        '& .MuiOutlinedInput-input': {
          py: 1,
        },
        ...props.sx,
      }}
      slotProps={{
        input: {
          startAdornment: Icon && (
            <InputAdornment position="start" sx={{ mr: 0.5 }}>
              <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: success && (
            <InputAdornment position="end" sx={{ ml: 0.5 }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
            </InputAdornment>
          ),
          ...props.slotProps?.input,
        },
        ...props.slotProps,
      }}
      {...props}
    />
  );
});

FormTextField.displayName = 'FormTextField';

// ============================================================================
// Main Component
// ============================================================================

export const BasicInfoStep = memo(({
  formData,
  setFormData,
  organizationId,
  setOrganizationId,
  isMobile = false,
  apiLoading = false,
  isSubmitting = false,
  handleChange,
  handleDateChange,
  handleStartTimeChange,
  handleEndTimeChange,
  errors = {},
  touched = {},
  onFieldTouch,
  onValidationChange,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const [localErrors, setLocalErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});

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

  const isScheduleComplete = useMemo(
    () => isDateFilled && isStartTimeFilled,
    [isDateFilled, isStartTimeFilled]
  );

  const isFormValid = useMemo(() => {
    if (!isTitleFilled) return false;
    if (!isDateFilled) return false;
    if (!isStartTimeFilled) return false;
    if (formData?.title?.length < 3) return false;
    if (formData?.title?.length > 200) return false;
    
    if (formData?.start_time && formData?.end_time) {
      const start = safeParseTime(formData.start_time);
      const end = safeParseTime(formData.end_time);
      if (start && end && end <= start) return false;
    }
    
    return true;
  }, [formData, isTitleFilled, isDateFilled, isStartTimeFilled]);

  const datePickerValue = useMemo(
    () => safeParseDate(formData?.meeting_date),
    [formData?.meeting_date]
  );

  const startTimePickerValue = useMemo(
    () => safeParseTime(formData?.start_time),
    [formData?.start_time]
  );

  const endTimePickerValue = useMemo(
    () => safeParseTime(formData?.end_time),
    [formData?.end_time]
  );

  const scheduleDisplay = useMemo(() => {
    if (!isDateFilled || !isStartTimeFilled) return null;
    
    const date = safeParseDate(formData.meeting_date);
    const start = safeParseTime(formData.start_time);
    
    if (!date || !start) return null;
    
    try {
      const dateFormatted = format(date, 'PPP');
      const startFormatted = format(start, 'p');
      let endFormatted = null;
      
      if (formData.end_time) {
        const end = safeParseTime(formData.end_time);
        if (end) {
          endFormatted = format(end, 'p');
        }
      }
      
      return {
        date: dateFormatted,
        startTime: startFormatted,
        endTime: endFormatted,
        full: `${dateFormatted} at ${startFormatted}${endFormatted ? ` - ${endFormatted}` : ''}`,
      };
    } catch (error) {
      console.warn('Error formatting schedule:', error);
      return null;
    }
  }, [formData.meeting_date, formData.start_time, formData.end_time, isDateFilled, isStartTimeFilled]);

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
      const date = safeParseDate(value);
      if (!date) {
        return VALIDATION_MESSAGES.meeting_date.invalid;
      }
    }

    return null;
  }, []);

  const handleFieldChange = useCallback((fieldName) => (event) => {
    const value = event?.target?.value || event;
    
    if (handleChange) {
      handleChange(event);
    } else {
      setFormData(prev => ({
        ...prev,
        [fieldName]: value,
      }));
    }

    handleFieldTouch(fieldName);

    const error = validateField(fieldName, value);
    setLocalErrors(prev => ({
      ...prev,
      [fieldName]: error,
    }));

    if (onValidationChange) {
      onValidationChange(fieldName, !error);
    }
  }, [handleChange, setFormData, handleFieldTouch, validateField, onValidationChange]);

  if (apiLoading && !formData) {
    return (
      <Box sx={{ width: '100%', p: 1 }}>
        <Stack spacing={1.5}>
          <Skeleton variant="rounded" height={80} />
          <Skeleton variant="rounded" height={60} />
          <Skeleton variant="rounded" height={80} />
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Stack spacing={1.5}>
        {/* Meeting Details Section - COMPACT */}
        <SectionPaper>
          <Stack spacing={1}>
            <SectionHeader
              icon={TitleIcon}
              title="Meeting Details"
              status={isTitleFilled ? 'complete' : null}
              statusText={isTitleFilled ? '✓' : undefined}
              tooltip="Provide a clear, descriptive title for your meeting"
            />

            <FormTextField
              required
              label="Meeting Title *"
              name="title"
              size="medium"
              value={formData?.title || ''}
              onChange={handleFieldChange('title')}
              onBlur={() => handleFieldTouch('title')}
              placeholder="Enter meeting title"
              icon={TitleIcon}
              success={isTitleFilled}
              error={!!(localErrors.title || errors.title)}
              helperText={
                localErrors.title || 
                errors.title || 
                `${formData?.title?.length || 0}/200`
              }
              disabled={apiLoading || isSubmitting}
              slotProps={{
                input: {
                  endAdornment: formData?.title && formData.title.length > 0 && (
                    <InputAdornment position="end" sx={{ ml: 0.5 }}>
                      <Chip
                        label={`${formData.title.length}/200`}
                        size="small"
                        color={formData.title.length > 190 ? 'warning' : 'default'}
                        sx={{ height: 18, fontSize: '0.55rem', '& .MuiChip-label': { px: 0.75 } }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              inputProps={{
                maxLength: 200,
                'aria-label': 'Meeting title',
              }}
            />

            <FormTextField
              label="Description"
              name="description"
              size="medium"
              value={formData?.description || ''}
              onChange={handleFieldChange('description')}
              onBlur={() => handleFieldTouch('description')}
              placeholder="Add context..."
              multiline
              rows={isMobile ? 3 : 4}
              icon={DescriptionIcon}
              disabled={apiLoading || isSubmitting}
              inputProps={{
                maxLength: 1000,
                'aria-label': 'Meeting description',
              }}
            />
          </Stack>
        </SectionPaper>

        {/* Schedule Section - COMPACT */}
        <SectionPaper>
          <Stack spacing={1}>
            <SectionHeader
              icon={EventIcon}
              title="Schedule"
              status={isScheduleComplete ? 'complete' : null}
              statusText={isScheduleComplete ? '✓' : undefined}
              tooltip="Set the date and time for your meeting"
            />

            <Grid container spacing={1}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="Meeting Date *"
                  value={datePickerValue}
                  onChange={handleDateChange}
                  disabled={apiLoading || isSubmitting}
                  format="PPP"
                  slotProps={{
                    textField: {
                      required: true,
                      size: 'small',
                      error: !!(localErrors.meeting_date || errors.meeting_date),
                      helperText: localErrors.meeting_date || errors.meeting_date || 'Select date',
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          bgcolor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.05)',
                        },
                        '& .MuiOutlinedInput-input': { py: 1 },
                      },
                      slotProps: {
                        input: {
                          startAdornment: (
                            <InputAdornment position="start" sx={{ mr: 0.5 }}>
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
                  value={startTimePickerValue}
                  onChange={handleStartTimeChange}
                  disabled={apiLoading || isSubmitting}
                  slotProps={{
                    textField: {
                      required: true,
                      size: 'small',
                      error: !!(localErrors.start_time || errors.start_time),
                      helperText: localErrors.start_time || errors.start_time || 'Start',
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          bgcolor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.05)',
                        },
                        '& .MuiOutlinedInput-input': { py: 1 },
                      },
                      slotProps: {
                        input: {
                          startAdornment: (
                            <InputAdornment position="start" sx={{ mr: 0.5 }}>
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
                  value={endTimePickerValue}
                  onChange={handleEndTimeChange}
                  disabled={apiLoading || isSubmitting}
                  slotProps={{
                    textField: {
                      size: 'small',
                      error: !!(localErrors.end_time || errors.end_time),
                      helperText: localErrors.end_time || errors.end_time || 'End (opt.)',
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          bgcolor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.05)',
                        },
                        '& .MuiOutlinedInput-input': { py: 1 },
                      },
                      slotProps: {
                        input: {
                          startAdornment: (
                            <InputAdornment position="start" sx={{ mr: 0.5 }}>
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

            {/* Schedule Summary - COMPACT */}
            <Box 
              sx={{ 
                visibility: scheduleDisplay ? 'visible' : 'hidden',
                opacity: scheduleDisplay ? 1 : 0,
                height: scheduleDisplay ? 'auto' : 0,
                overflow: 'hidden',
                transition: 'opacity 0.2s ease',
              }}
            >
              <Alert
                icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
                severity="success"
                sx={{
                  py: 0.25,
                  px: 1,
                  alignItems: 'center',
                  minHeight: 0,
                  '& .MuiAlert-icon': { py: 0, pr: 0.5 },
                  '& .MuiAlert-message': { py: 0.25, width: '100%' },
                }}
              >
                <Typography variant="caption" component="div" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
                  <strong>Scheduled:</strong> {scheduleDisplay?.full || ''}
                </Typography>
              </Alert>
            </Box>

            {/* Time Validation Warning - COMPACT */}
            {formData?.start_time && formData?.end_time && (
              (() => {
                const start = safeParseTime(formData.start_time);
                const end = safeParseTime(formData.end_time);
                if (start && end && end <= start) {
                  return (
                    <Alert severity="error" icon={<WarningIcon sx={{ fontSize: 16 }} />} sx={{ py: 0, px: 1 }}>
                      <Typography variant="caption">End time must be after start time</Typography>
                    </Alert>
                  );
                }
                return null;
              })()
            )}
          </Stack>
        </SectionPaper>

        {/* Validation Summary - COMPACT */}
        {!isFormValid && Object.keys(touched).length > 0 && (
          <Alert 
            severity="info" 
            icon={<InfoIcon sx={{ fontSize: 16 }} />}
            sx={{ 
              py: 0.5, 
              px: 1.5,
              '& .MuiAlert-message': { py: 0.25 },
              '& ul': { m: 0, pl: 1.5 }
            }}
          >
            <Typography variant="caption" component="div">
              Please fill in all required fields:
              <ul style={{ margin: '2px 0 0 0', paddingLeft: '16px' }}>
                {!isTitleFilled && <li>Meeting title</li>}
                {!isDateFilled && <li>Meeting date</li>}
                {!isStartTimeFilled && <li>Start time</li>}
                {formData?.title?.length < 3 && formData?.title?.length > 0 && (
                  <li>Title must be at least 3 characters</li>
                )}
              </ul>
            </Typography>
          </Alert>
        )}

        <input type="hidden" name="organizationId" value={organizationId} />
      </Stack>
    </Box>
  );
});

BasicInfoStep.displayName = 'BasicInfoStep';

export default BasicInfoStep;