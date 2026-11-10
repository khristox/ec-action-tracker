// src/components/meetings/MeetingForm/components/RecurrenceSection.jsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, CardContent, Stack, Paper, Switch, Typography, Chip, Box, Grid,
  FormControl, InputLabel, Select, MenuItem, TextField, ToggleButton,
  FormHelperText, Button, Alert, IconButton, Badge, FormControlLabel,
  RadioGroup, Radio
} from '@mui/material';
import {
  Repeat as RepeatIcon, Preview as PreviewIcon, Close as Close,
  Today as TodayIcon, Info as InfoIcon, Event as EventIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isBefore, startOfDay } from 'date-fns';
import { RECURRENCE_TYPES, WEEK_DAYS, END_OPTIONS } from '../constants';
import {
  formatRecurrenceSummary,
  generatePreviewOccurrences,
  getDefaultRecurrence,
  normalizeRecurrence,
  isLegacyRecurrence,
  RECURRENCE_LIMITS,
  MAX_OCCURRENCES
} from '../utils';

const MONTHLY_WEEK_OPTIONS = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'third', label: 'Third' },
  { value: 'fourth', label: 'Fourth' },
  { value: 'last', label: 'Last' }
];

// Zoom-style: only daily / weekly / monthly (biweekly = weekly every 2 weeks),
// and the series always ends by date or after N occurrences.
const TYPE_OPTIONS = RECURRENCE_TYPES.filter(t => RECURRENCE_LIMITS[t.value]);
const END_OPTIONS_LIMITED = END_OPTIONS.filter(o => o.value !== 'never');

const normalizeDate = (date) => {
  if (!date) return null;
  const value = date instanceof Date ? date : new Date(date);
  return Number.isNaN(value.getTime()) ? null : value;
};

const ordinalSuffix = (day) =>
  day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';

export const RecurrenceSection = ({ recurrence, setRecurrence, startDate }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewDates, setPreviewDates] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // recurrence.enabled is the single source of truth.
  const isRecurring = !!recurrence?.enabled;

  const currentType = recurrence?.type || 'weekly';
  const limit = RECURRENCE_LIMITS[currentType] || RECURRENCE_LIMITS.weekly;

  // Migrate legacy data (biweekly, quarterly, "never") to the Zoom-style model.
  useEffect(() => {
    if (recurrence?.enabled && isLegacyRecurrence(recurrence)) {
      setRecurrence(normalizeRecurrence(recurrence));
    }
  }, [recurrence, setRecurrence]);

  const handleRecurringToggle = (checked) => {
    if (checked) {
      // Weekday / day of month default to the meeting's start date.
      setRecurrence(getDefaultRecurrence(startDate));
      setStatusMessage('');
    } else {
      setRecurrence(null);
      setPreviewDates([]);
      setShowPreview(false);
      setStatusMessage('');
    }
  };

  const updateRecurrence = (field, value) => {
    setRecurrence(prev => ({
      ...(prev || {}),
      [field]: value
    }));
  };

  const handleTypeChange = (type) => {
    const defaults = getDefaultRecurrence(startDate);

    setRecurrence(prev => {
      const p = prev || {};
      return {
        ...p,
        type,
        // Respect the per-type interval cap (e.g. max 3 months).
        interval: Math.min(p.interval || 1, RECURRENCE_LIMITS[type].max),
        ...(type === 'weekly' && !p.days?.length
          ? { days: defaults.days }
          : {}),
        ...(type === 'monthly'
          ? {
              monthly_pattern: p.monthly_pattern || 'day_of_month',
              day_of_month: p.day_of_month || defaults.day_of_month,
              monthly_week: p.monthly_week || defaults.monthly_week,
              monthly_day: p.monthly_day || defaults.monthly_day
            }
          : {})
      };
    });
  };

  const calculatePreviewDates = useCallback(() => {
    if (!startDate) {
      setStatusMessage('Please select a start date above to view upcoming occurrences.');
      setPreviewDates([]);
      return;
    }

    if (!recurrence?.enabled) {
      setPreviewDates([]);
      return;
    }

    setLoadingPreview(true);

    try {
      const dates = generatePreviewOccurrences(
        recurrence,
        new Date(startDate),
        5
      );

      setPreviewDates(dates);
      setStatusMessage(
        `Displaying the next ${dates.length} scheduled occurrences.`
      );
    } catch (error) {
      console.error('Unable to calculate recurrence preview:', error);
      setStatusMessage(
        'Unable to calculate occurrences with the current schedule settings.'
      );
      setPreviewDates([]);
    } finally {
      setLoadingPreview(false);
    }
  }, [recurrence, startDate]);

  useEffect(() => {
    if (showPreview && recurrence?.enabled && startDate) {
      calculatePreviewDates();
    }
  }, [showPreview, recurrence, startDate, calculatePreviewDates]);

  const toggleDay = (day) => {
    const currentDays = recurrence?.days || [];

    if (currentDays.includes(day)) {
      updateRecurrence('days', currentDays.filter(d => d !== day));
    } else {
      updateRecurrence('days', [...currentDays, day]);
    }
  };

  const handleEndOptionChange = (value) => {
    setRecurrence(prev => {
      const next = { ...(prev || {}), end_option: value };

      if (value === 'after') {
        next.end_date = null;
        const m = Number(next.max_occurrences);
        next.max_occurrences =
          Number.isInteger(m) && m >= 1 ? Math.min(m, MAX_OCCURRENCES) : 10;
      } else if (value === 'on') {
        next.max_occurrences = null;
      }

      return next;
    });
  };

  const startDateValue = normalizeDate(startDate);
  const endDateValue = normalizeDate(recurrence?.end_date);

  const endDateError =
    recurrence?.end_option === 'on' &&
    startDateValue &&
    endDateValue &&
    isBefore(startOfDay(endDateValue), startOfDay(startDateValue));

  const endDateMissing =
    isRecurring && recurrence?.end_option === 'on' && !endDateValue;

  const weeklyDaysError =
    isRecurring &&
    currentType === 'weekly' &&
    (!recurrence?.days || recurrence.days.length === 0);

  const occurrencesError =
    isRecurring &&
    recurrence?.end_option === 'after' &&
    (!Number.isInteger(Number(recurrence?.max_occurrences)) ||
      Number(recurrence?.max_occurrences) < 1 ||
      Number(recurrence?.max_occurrences) > MAX_OCCURRENCES);

  const recurrenceHasValidationError =
    weeklyDaysError || endDateError || endDateMissing || occurrencesError;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Recurrence Overview
          </Typography>

          <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
            • <strong>Start Date:</strong>{' '}
            {startDate
              ? format(new Date(startDate), 'MMMM d, yyyy')
              : 'Please select a start date above'}
          </Typography>

          <Typography variant="body2" component="div">
            • <strong>Status:</strong>{' '}
            {isRecurring
              ? 'Recurring schedule enabled'
              : 'Single meeting (not recurring)'}
          </Typography>

          {isRecurring && (
            <Typography variant="body2" component="div">
              • <strong>Summary:</strong>{' '}
              {formatRecurrenceSummary(recurrence)}
            </Typography>
          )}

          {statusMessage && (
            <Typography
              variant="caption"
              component="div"
              sx={{ mt: 1, fontStyle: 'italic' }}
            >
              {statusMessage}
            </Typography>
          )}
        </Alert>

        <Stack spacing={3}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderColor: isRecurring ? 'primary.main' : 'divider'
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={2}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Switch
                  checked={isRecurring}
                  onChange={(e) => handleRecurringToggle(e.target.checked)}
                  color="primary"
                />

                <Stack>
                  <Typography variant="h6" fontWeight={600}>
                    <RepeatIcon
                      sx={{ mr: 1, verticalAlign: 'middle' }}
                      color={isRecurring ? 'primary' : 'action'}
                    />
                    Make this a recurring meeting
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Create a series of meetings that repeat on a schedule
                  </Typography>
                </Stack>
              </Stack>

              {isRecurring && (
                <Chip
                  icon={<RepeatIcon />}
                  label={formatRecurrenceSummary(recurrence)}
                  color="primary"
                  variant="outlined"
                />
              )}
            </Stack>
          </Paper>

          {isRecurring && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Recurrence Pattern
              </Typography>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Recurrence</InputLabel>
                    <Select
                      value={currentType}
                      onChange={(e) => handleTypeChange(e.target.value)}
                      label="Recurrence"
                    >
                      {TYPE_OPTIONS.map(type => (
                        <MenuItem key={type.value} value={type.value}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body1">
                              {type.icon}
                            </Typography>
                            <Typography variant="body1">
                              {type.label}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              ({type.description})
                            </Typography>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Repeat every"
                    value={recurrence?.interval || 1}
                    onChange={(e) =>
                      updateRecurrence(
                        'interval',
                        Math.min(
                          limit.max,
                          Math.max(1, parseInt(e.target.value, 10) || 1)
                        )
                      )
                    }
                    InputProps={{
                      inputProps: { min: 1, max: limit.max }
                    }}
                    helperText={`${limit.unit} (max ${limit.max})`}
                  />
                </Grid>

                {currentType === 'weekly' && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Repeat on
                    </Typography>

                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        rowGap: 1
                      }}
                    >
                      {WEEK_DAYS.map(day => (
                        <ToggleButton
                          key={day.value}
                          value={day.value}
                          selected={!!recurrence?.days?.includes(day.value)}
                          onChange={() => toggleDay(day.value)}
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            '&.Mui-selected': {
                              bgcolor: 'primary.main',
                              color: 'white',
                              '&:hover': {
                                bgcolor: 'primary.dark'
                              }
                            }
                          }}
                        >
                          <Stack direction="column" alignItems="center">
                            <Typography variant="caption" fontWeight={600}>
                              {day.label}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ fontSize: '0.6rem' }}
                            >
                              {day.full.substring(0, 2)}
                            </Typography>
                          </Stack>
                        </ToggleButton>
                      ))}
                    </Stack>

                    {weeklyDaysError ? (
                      <FormHelperText error>
                        Please select at least one day.
                      </FormHelperText>
                    ) : (
                      <FormHelperText>
                        Select one or more days for the recurring meeting.
                      </FormHelperText>
                    )}
                  </Grid>
                )}

                {currentType === 'monthly' && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Repeat on
                    </Typography>

                    <RadioGroup
                      value={recurrence?.monthly_pattern || 'day_of_month'}
                      onChange={(e) =>
                        updateRecurrence('monthly_pattern', e.target.value)
                      }
                    >
                      <FormControlLabel
                        value="day_of_month"
                        control={<Radio />}
                        label="Day of the month"
                      />

                      {(recurrence?.monthly_pattern || 'day_of_month') === 'day_of_month' && (
                        <Box sx={{ ml: 4, mb: 1 }}>
                          <FormControl size="small" sx={{ minWidth: 220 }}>
                            <InputLabel>Day of month</InputLabel>
                            <Select
                              value={recurrence?.day_of_month || 1}
                              onChange={(e) =>
                                updateRecurrence('day_of_month', e.target.value)
                              }
                              label="Day of month"
                            >
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                <MenuItem key={day} value={day}>
                                  {day}{ordinalSuffix(day)} day
                                </MenuItem>
                              ))}

                              <MenuItem value="last">Last day</MenuItem>
                            </Select>
                          </FormControl>
                          <FormHelperText>
                            Months with fewer days use their last day.
                          </FormHelperText>
                        </Box>
                      )}

                      <FormControlLabel
                        value="relative_weekday"
                        control={<Radio />}
                        label="Relative weekday"
                      />

                      {recurrence?.monthly_pattern === 'relative_weekday' && (
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={2}
                          sx={{ ml: 4, mb: 1 }}
                        >
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Week</InputLabel>
                            <Select
                              value={recurrence?.monthly_week || 'first'}
                              onChange={(e) =>
                                updateRecurrence('monthly_week', e.target.value)
                              }
                              label="Week"
                            >
                              {MONTHLY_WEEK_OPTIONS.map(option => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <FormControl size="small" sx={{ minWidth: 170 }}>
                            <InputLabel>Weekday</InputLabel>
                            <Select
                              value={recurrence?.monthly_day || 'monday'}
                              onChange={(e) =>
                                updateRecurrence('monthly_day', e.target.value)
                              }
                              label="Weekday"
                            >
                              {WEEK_DAYS.map(day => (
                                <MenuItem key={day.value} value={day.value}>
                                  {day.full}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Stack>
                      )}
                    </RadioGroup>
                  </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    End recurrence
                  </Typography>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                  >
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>End</InputLabel>
                      <Select
                        value={recurrence?.end_option || 'after'}
                        onChange={(e) => handleEndOptionChange(e.target.value)}
                        label="End"
                      >
                        {END_OPTIONS_LIMITED.map(opt => (
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
                        label="Number of occurrences"
                        sx={{ width: 220 }}
                        value={recurrence?.max_occurrences ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateRecurrence(
                            'max_occurrences',
                            value === ''
                              ? ''
                              : Math.max(
                                  1,
                                  Math.min(
                                    MAX_OCCURRENCES,
                                    parseInt(value, 10) || 1
                                  )
                                )
                          );
                        }}
                        error={occurrencesError}
                        helperText={
                          occurrencesError
                            ? `Enter between 1 and ${MAX_OCCURRENCES} occurrences.`
                            : `Maximum ${MAX_OCCURRENCES} occurrences`
                        }
                        InputProps={{
                          inputProps: { min: 1, max: MAX_OCCURRENCES }
                        }}
                      />
                    )}

                    {recurrence?.end_option === 'on' && (
                      <DatePicker
                        label="End date"
                        value={endDateValue}
                        minDate={startDateValue || undefined}
                        onChange={(date) => updateRecurrence('end_date', date)}
                        slotProps={{
                          textField: {
                            size: 'small',
                            sx: { width: 250 },
                            error: !!endDateError || endDateMissing,
                            helperText: endDateError
                              ? 'End date cannot be before the meeting start date.'
                              : endDateMissing
                                ? 'Please choose an end date.'
                                : undefined
                          }
                        }}
                      />
                    )}
                  </Stack>
                </Grid>
              </Grid>

              <Stack
                direction="row"
                justifyContent="flex-end"
                sx={{ mt: 2 }}
              >
                <Button
                  variant="outlined"
                  startIcon={<PreviewIcon />}
                  onClick={() => setShowPreview(!showPreview)}
                  size="small"
                  disabled={recurrenceHasValidationError}
                >
                  {showPreview ? 'Hide Preview' : 'Preview Occurrences'}
                </Button>
              </Stack>

              {showPreview && (
                <Alert
                  severity="info"
                  sx={{ mt: 2 }}
                  icon={<TodayIcon />}
                  action={
                    <IconButton
                      size="small"
                      onClick={() => setShowPreview(false)}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  }
                >
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    gutterBottom
                  >
                    Upcoming Occurrences
                  </Typography>

                  {loadingPreview ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
                    </div>
                  ) : previewDates.length > 0 ? (
                    <Stack
                      spacing={1}
                      sx={{ mt: 1, maxHeight: 300, overflow: 'auto' }}
                    >
                      {previewDates.map((date, idx) => (
                        <Stack
                          key={idx}
                          direction="row"
                          alignItems="center"
                          spacing={2}
                        >
                          <Badge badgeContent={idx + 1} color="primary" />
                          <EventIcon fontSize="small" />
                          <Typography variant="body2">
                            {format(date, 'EEEE, MMMM d, yyyy')}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2">
                      {startDate
                        ? 'No occurrences to preview based on current settings.'
                        : 'Please select a meeting start date above to generate a preview.'}
                    </Typography>
                  )}

                  {startDate && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: 'block' }}
                    >
                      Based on start date:{' '}
                      {format(new Date(startDate), 'MMM d, yyyy')}
                    </Typography>
                  )}
                </Alert>
              )}

              <Alert severity="info" sx={{ mt: 2 }} icon={<InfoIcon />}>
                <Typography variant="body2">
                  <strong>How it works:</strong> This will create a
                  series of meetings based on the pattern above. The
                  recurring meeting will appear in your dashboard
                  showing the next occurrence date. When you click
                  "Join", the actual meeting instance will be created.
                  The action log belongs to the whole series, so
                  actions from every occurrence are kept together.
                </Typography>
              </Alert>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default RecurrenceSection;
