// src/components/actiontracker/meetings/components/RecurringMeetingSection.jsx
// FIXED VERSION - Addresses preview calculation and API issues

import React, { useState, useEffect } from 'react';
import {
  Stack,
  Typography,
  Switch,
  Chip,
  Divider,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  ToggleButton,
  Box,
  FormHelperText,
  Collapse,
  Button,
  Alert,
  IconButton,
  Badge,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  Repeat as RepeatIcon,
  Preview as PreviewIcon,
  Today as TodayIcon,
  Close as CloseIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// ==================== Constants ====================

const RECURRENCE_TYPES = [
  { value: 'daily', label: 'Daily', intervalText: 'day(s)' },
  { value: 'weekly', label: 'Weekly', intervalText: 'week(s)' },
  { value: 'biweekly', label: 'Bi-Weekly', intervalText: 'week(s)' },
  { value: 'monthly', label: 'Monthly', intervalText: 'month(s)' },
  { value: 'quarterly', label: 'Quarterly', intervalText: 'quarter(s)' },
  { value: 'yearly', label: 'Yearly', intervalText: 'year(s)' },
];

const WEEK_DAYS = [
  { value: 'monday', label: 'M', full: 'Monday', dayIndex: 1 },
  { value: 'tuesday', label: 'T', full: 'Tuesday', dayIndex: 2 },
  { value: 'wednesday', label: 'W', full: 'Wednesday', dayIndex: 3 },
  { value: 'thursday', label: 'T', full: 'Thursday', dayIndex: 4 },
  { value: 'friday', label: 'F', full: 'Friday', dayIndex: 5 },
  { value: 'saturday', label: 'S', full: 'Saturday', dayIndex: 6 },
  { value: 'sunday', label: 'S', full: 'Sunday', dayIndex: 0 },
];

const END_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'after', label: 'After X occurrences' },
  { value: 'on', label: 'On date' },
];

// ==================== Utility Functions ====================

const getDayName = (date) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

const calculateNextOccurrence = (recurrence, fromDate) => {
  if (!recurrence) return null;

  let nextDate = new Date(fromDate);
  nextDate.setHours(0, 0, 0, 0);

  switch (recurrence.type) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + recurrence.interval);
      break;

    case 'weekly': {
      // Move to next day and find first selected day
      nextDate.setDate(nextDate.getDate() + 1);
      let attempts = 0;
      while (attempts < 7 && !recurrence.days?.includes(getDayName(nextDate))) {
        nextDate.setDate(nextDate.getDate() + 1);
        attempts++;
      }
      // If we've gone through a full week without finding a selected day, add a week
      if (attempts === 7) {
        nextDate.setDate(nextDate.getDate() + 7);
      }
      break;
    }

    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14 * recurrence.interval);
      break;

    case 'monthly':
      if (recurrence.day_of_month === 'last') {
        nextDate.setMonth(nextDate.getMonth() + recurrence.interval + 1, 0);
      } else {
        nextDate.setMonth(nextDate.getMonth() + recurrence.interval);
        nextDate.setDate(Math.min(recurrence.day_of_month, 31));
      }
      break;

    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3 * recurrence.interval);
      break;

    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + recurrence.interval);
      break;

    default:
      return null;
  }

  return nextDate;
};

// ==================== Component ====================

export const RecurringMeetingSection = ({ recurrence, setRecurrence }) => {
  const theme = useTheme();
  const isRecurring = !!recurrence?.enabled;
  const [showPreview, setShowPreview] = useState(false);
  const [previewDates, setPreviewDates] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleRecurringToggle = (checked) => {
    if (checked) {
      setRecurrence({
        enabled: true,
        type: 'weekly',
        interval: 1,
        days: ['monday', 'wednesday', 'friday'],
        day_of_month: 1,
        end_option: 'never',
        end_date: null,
        max_occurrences: null,
      });
    } else {
      setRecurrence(null);
    }
  };

  const updateRecurrence = (field, value) => {
    setRecurrence((prev) => ({ ...prev, [field]: value }));
  };

  const fetchPreview = async () => {
    if (!recurrence?.enabled) return;
    
    setLoadingPreview(true);
    try {
      const dates = [];
      let currentDate = new Date();
      const maxToShow = Math.min(recurrence.max_occurrences || 10, 5);
      const endDate = recurrence.end_date ? new Date(recurrence.end_date) : null;

      for (let i = 0; i < maxToShow; i++) {
        const nextDate = calculateNextOccurrence(recurrence, currentDate);
        
        if (!nextDate) break;
        if (endDate && nextDate > endDate) break;

        dates.push(new Date(nextDate));
        currentDate = nextDate;
      }

      setPreviewDates(dates);
    } catch (error) {
      console.error('Error fetching preview:', error);
      setPreviewDates([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (showPreview && recurrence?.enabled) {
      fetchPreview();
    }
  }, [showPreview, recurrence?.type, recurrence?.interval, recurrence?.days, recurrence?.end_option, recurrence?.end_date, recurrence?.max_occurrences]);

  const toggleDay = (day) => {
    const currentDays = recurrence?.days || [];
    updateRecurrence(
      'days',
      currentDays.includes(day)
        ? currentDays.filter((d) => d !== day)
        : [...currentDays, day]
    );
  };

  const getIntervalText = () => {
    const typeConfig = RECURRENCE_TYPES.find((t) => t.value === recurrence?.type);
    return `Every ${recurrence?.interval || 1} ${typeConfig?.intervalText || 'day(s)'}`;
  };

  return (
    <Stack spacing={2}>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ py: 0.5 }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <RepeatIcon fontSize="small" color={isRecurring ? 'primary' : 'action'} />
          <Box>
            <Typography variant="body2" fontWeight={600}>
              Recurring meeting
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Repeat this meeting on a schedule
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {isRecurring && (
            <Chip
              size="small"
              label={getIntervalText()}
              color="primary"
              variant="outlined"
            />
          )}
          <Switch
            checked={isRecurring}
            onChange={(e) => handleRecurringToggle(e.target.checked)}
            color="primary"
          />
        </Stack>
      </Stack>

      {/* Recurrence Settings */}
      <Collapse in={isRecurring}>
        <Stack spacing={2.5}>
          <Divider />

          <Grid container spacing={2}>
            {/* Recurrence Type */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Repeats every</InputLabel>
                <Select
                  value={recurrence?.type || 'weekly'}
                  onChange={(e) => updateRecurrence('type', e.target.value)}
                  label="Repeats every"
                >
                  {RECURRENCE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      <Typography variant="body2">{type.label}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Interval */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Interval"
                value={recurrence?.interval || 1}
                onChange={(e) =>
                  updateRecurrence('interval', parseInt(e.target.value) || 1)
                }
                InputProps={{
                  inputProps: { min: 1, max: 365 },
                  endAdornment: (
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                      {RECURRENCE_TYPES.find((t) => t.value === recurrence?.type)
                        ?.intervalText || 'day(s)'}
                    </Typography>
                  ),
                }}
              />
            </Grid>

            {/* Weekly Days */}
            {(recurrence?.type === 'weekly' || recurrence?.type === 'biweekly') && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                  Repeat on
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {WEEK_DAYS.map((day) => (
                    <ToggleButton
                      key={day.value}
                      value={day.value}
                      selected={recurrence?.days?.includes(day.value)}
                      onChange={() => toggleDay(day.value)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        '&.Mui-selected': {
                          bgcolor: theme.palette.primary.main,
                          color: 'white',
                        },
                      }}
                    >
                      <Typography variant="caption" fontWeight={600}>
                        {day.label}
                      </Typography>
                    </ToggleButton>
                  ))}
                </Stack>
                {(!recurrence?.days || recurrence?.days.length === 0) && (
                  <FormHelperText error>Select at least one day</FormHelperText>
                )}
              </Grid>
            )}

            {/* Monthly Day Selection */}
            {recurrence?.type === 'monthly' && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Day of month</InputLabel>
                  <Select
                    value={recurrence?.day_of_month || 1}
                    onChange={(e) => updateRecurrence('day_of_month', e.target.value)}
                    label="Day of month"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <MenuItem key={day} value={day}>
                        {day}
                      </MenuItem>
                    ))}
                    <MenuItem value="last">Last day of month</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* End Options */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                End recurrence
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <Select
                    value={recurrence?.end_option || 'never'}
                    onChange={(e) => updateRecurrence('end_option', e.target.value)}
                  >
                    {END_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {recurrence?.end_option === 'after' && (
                  <TextField
                    size="small"
                    type="number"
                    label="Occurrences"
                    sx={{ width: 160 }}
                    value={recurrence?.max_occurrences || ''}
                    onChange={(e) =>
                      updateRecurrence('max_occurrences', parseInt(e.target.value) || 0)
                    }
                    InputProps={{ inputProps: { min: 1, max: 999 } }}
                  />
                )}

                {recurrence?.end_option === 'on' && (
                  <DatePicker
                    label="End date"
                    value={recurrence?.end_date}
                    onChange={(date) => updateRecurrence('end_date', date)}
                    slotProps={{ textField: { size: 'small', sx: { width: 200 } } }}
                  />
                )}
              </Stack>
            </Grid>
          </Grid>

          {/* Preview Button */}
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="text"
              startIcon={<PreviewIcon />}
              onClick={() => setShowPreview(!showPreview)}
              size="small"
            >
              {showPreview ? 'Hide Preview' : 'Preview Occurrences'}
            </Button>
          </Stack>

          {/* Preview */}
          <Collapse in={showPreview}>
            <Alert
              severity="info"
              icon={<TodayIcon />}
              action={
                <IconButton size="small" onClick={() => setShowPreview(false)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              }
            >
              <Typography variant="caption" fontWeight={600} gutterBottom display="block">
                Upcoming Occurrences
              </Typography>
              {loadingPreview ? (
                <CircularProgress size={20} />
              ) : previewDates.length > 0 ? (
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {previewDates.map((date, idx) => (
                    <Stack key={idx} direction="row" alignItems="center" spacing={1}>
                      <Badge badgeContent={idx + 1} color="primary" />
                      <Typography variant="caption">
                        {date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  No occurrences to preview. Check your recurrence settings.
                </Typography>
              )}
            </Alert>
          </Collapse>

          {/* Info Alert */}
          <Alert severity="info" icon={<InfoIcon />}>
            Each occurrence is created as a separate meeting. You can edit individual
            occurrences later from the Recurring Meetings dashboard.
          </Alert>
        </Stack>
      </Collapse>
    </Stack>
  );
};

export default RecurringMeetingSection;