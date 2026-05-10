// src/components/meetings/MeetingForm/components/RecurrenceSection.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, CardContent, Stack, Paper, Switch, Typography, Chip, Box, Grid,
  FormControl, InputLabel, Select, MenuItem, TextField, ToggleButton,
  FormHelperText, Button, Alert, IconButton, Badge
} from '@mui/material';
import {
  Repeat as RepeatIcon, Preview as PreviewIcon, Close as CloseIcon,
  Today as TodayIcon, Info as InfoIcon, Event as EventIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import { RECURRENCE_TYPES, WEEK_DAYS, END_OPTIONS } from '../constants';
import { calculateNextOccurrence, formatRecurrenceSummary } from '../utils';

export const RecurrenceSection = ({ recurrence, setRecurrence, startDate }) => {
  const [isRecurring, setIsRecurring] = useState(!!recurrence?.enabled);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDates, setPreviewDates] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleRecurringToggle = (checked) => {
    setIsRecurring(checked);
    if (checked) {
      const newRecurrence = { 
        enabled: true, 
        type: 'weekly', 
        interval: 1, 
        days: ['monday'], 
        day_of_month: 1, 
        end_option: 'never', 
        end_date: null, 
        max_occurrences: null 
      };
      setRecurrence(newRecurrence);
    } else { 
      setRecurrence(null);
    }
  };

  const updateRecurrence = (field, value) => { 
    setRecurrence(prev => ({ ...prev, [field]: value }));
  };

  const calculatePreviewDates = useCallback(() => {
    if (!recurrence?.enabled || !startDate) return;
    
    setLoadingPreview(true);
    const dates = [];
    let currentDate = new Date(startDate);
    const maxOccurrences = Math.min(recurrence.max_occurrences || 10, 20);
    const endDate = recurrence.end_date ? new Date(recurrence.end_date) : null;
    
    for (let i = 0; i < maxOccurrences; i++) {
      const nextDate = calculateNextOccurrence(recurrence, currentDate);
      if (!nextDate) break;
      if (endDate && nextDate > endDate) break;
      dates.push(nextDate);
      currentDate = nextDate;
    }
    
    setPreviewDates(dates);
    setLoadingPreview(false);
  }, [recurrence, startDate]);

  useEffect(() => {
    if (showPreview && recurrence?.enabled && startDate) {
      calculatePreviewDates();
    }
  }, [showPreview, recurrence, startDate, calculatePreviewDates]);

  const toggleDay = (day) => {
    const currentDays = recurrence?.days || [];
    updateRecurrence('days', currentDays.includes(day) 
      ? currentDays.filter(d => d !== day) 
      : [...currentDays, day]);
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: isRecurring ? 'primary.main' : 'divider' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Switch 
                  checked={isRecurring} 
                  onChange={(e) => handleRecurringToggle(e.target.checked)} 
                  color="primary" 
                  size="large" 
                />
                <Stack>
                  <Typography variant="h6" fontWeight={600}>
                    <RepeatIcon sx={{ mr: 1, verticalAlign: 'middle' }} color={isRecurring ? 'primary' : 'action'} />
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
                    <InputLabel>Repeats every</InputLabel>
                    <Select 
                      value={recurrence?.type || 'weekly'} 
                      onChange={(e) => updateRecurrence('type', e.target.value)} 
                      label="Repeats every"
                    >
                      {RECURRENCE_TYPES.map(type => (
                        <MenuItem key={type.value} value={type.value}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body1">{type.icon}</Typography>
                            <Typography variant="body1">{type.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
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
                    onChange={(e) => updateRecurrence('interval', parseInt(e.target.value) || 1)}
                    InputProps={{ inputProps: { min: 1, max: 365 } }}
                    helperText={RECURRENCE_TYPES.find(t => t.value === recurrence?.type)?.intervalText || 'day(s)'}
                  />
                </Grid>

                {(recurrence?.type === 'weekly' || recurrence?.type === 'biweekly') && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom>Repeat on</Typography>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
                      {WEEK_DAYS.map(day => (
                        <ToggleButton
                          key={day.value}
                          value={day.value}
                          selected={recurrence?.days?.includes(day.value)}
                          onChange={() => toggleDay(day.value)}
                          sx={{ 
                            width: 48, 
                            height: 48, 
                            borderRadius: 2,
                            '&.Mui-selected': { bgcolor: 'primary.main', color: 'white' }
                          }}
                        >
                          <Stack direction="column" alignItems="center">
                            <Typography variant="caption" fontWeight={600}>{day.label}</Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
                              {day.full.substring(0, 2)}
                            </Typography>
                          </Stack>
                        </ToggleButton>
                      ))}
                    </Stack>
                    {(!recurrence?.days || recurrence?.days.length === 0) && (
                      <FormHelperText error>Please select at least one day</FormHelperText>
                    )}
                    {recurrence?.type === 'biweekly' && (
                      <FormHelperText>Meeting will occur every {recurrence.interval * 2} weeks</FormHelperText>
                    )}
                  </Grid>
                )}

                {recurrence?.type === 'monthly' && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Day of month</InputLabel>
                      <Select 
                        value={recurrence?.day_of_month || 1} 
                        onChange={(e) => updateRecurrence('day_of_month', e.target.value)} 
                        label="Day of month"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <MenuItem key={day} value={day}>
                            {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} day
                          </MenuItem>
                        ))}
                        <MenuItem value="last">Last day</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>End recurrence</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <Select 
                        value={recurrence?.end_option || 'never'} 
                        onChange={(e) => updateRecurrence('end_option', e.target.value)}
                      >
                        {END_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {recurrence?.end_option === 'after' && (
                      <TextField 
                        size="small" 
                        type="number" 
                        label="Number of occurrences" 
                        sx={{ width: 200 }}
                        value={recurrence?.max_occurrences || ''} 
                        onChange={(e) => updateRecurrence('max_occurrences', parseInt(e.target.value) || 0)}
                        InputProps={{ inputProps: { min: 1, max: 999 } }}
                      />
                    )}
                    {recurrence?.end_option === 'on' && (
                      <DatePicker 
                        label="End date" 
                        value={recurrence?.end_date} 
                        onChange={(date) => updateRecurrence('end_date', date)}
                        slotProps={{ textField: { size: 'small', sx: { width: 250 } } }}
                      />
                    )}
                  </Stack>
                </Grid>
              </Grid>

              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button 
                  variant="outlined" 
                  startIcon={<PreviewIcon />} 
                  onClick={() => setShowPreview(!showPreview)} 
                  size="small"
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
                    <IconButton size="small" onClick={() => setShowPreview(false)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Upcoming Occurrences
                  </Typography>
                  {loadingPreview ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                    </div>
                  ) : previewDates.length > 0 ? (
                    <Stack spacing={1} sx={{ mt: 1, maxHeight: 300, overflow: 'auto' }}>
                      {previewDates.map((date, idx) => (
                        <Stack key={idx} direction="row" alignItems="center" spacing={2}>
                          <Badge badgeContent={idx + 1} color="primary" />
                          <EventIcon fontSize="small" />
                          <Typography variant="body2">
                            {format(date, 'EEEE, MMMM d, yyyy')}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2">No occurrences to preview</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Based on start date: {startDate ? format(new Date(startDate), 'MMM d, yyyy') : 'Not set'}
                  </Typography>
                </Alert>
              )}

              <Alert severity="info" sx={{ mt: 2 }} icon={<InfoIcon />}>
                <Typography variant="body2">
                  <strong>How it works:</strong> This will create a series of meetings based on the pattern above.
                  The recurring meeting will appear in your dashboard showing the next occurrence date.
                  When you click "Join", the actual meeting instance will be created.
                </Typography>
              </Alert>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};