// src/components/meetings/RecurringMeetingSection.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Stack,
  Typography,
  Switch,
  FormControlLabel,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  Button,
  Paper,
  Grid,
  FormHelperText,
  ToggleButton,
  ToggleButtonGroup,
  Badge,
  useTheme,
  alpha
} from '@mui/material';
import {
  Repeat as RepeatIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Visibility as PreviewIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const RECURRENCE_TYPES = [
  { value: 'daily', label: 'Daily', icon: '📅', description: 'Repeats every day' },
  { value: 'weekly', label: 'Weekly', icon: '📆', description: 'Repeats every week on selected days' },
  { value: 'biweekly', label: 'Bi-Weekly', icon: '🔄', description: 'Repeats every two weeks' },
  { value: 'monthly', label: 'Monthly', icon: '📅', description: 'Repeats every month on selected date' },
  { value: 'quarterly', label: 'Quarterly', icon: '📊', description: 'Repeats every 3 months' },
  { value: 'yearly', label: 'Yearly', icon: '🎉', description: 'Repeats every year' }
];

const WEEK_DAYS = [
  { value: 'monday', label: 'Mon', full: 'Monday' },
  { value: 'tuesday', label: 'Tue', full: 'Tuesday' },
  { value: 'wednesday', label: 'Wed', full: 'Wednesday' },
  { value: 'thursday', label: 'Thu', full: 'Thursday' },
  { value: 'friday', label: 'Fri', full: 'Friday' },
  { value: 'saturday', label: 'Sat', full: 'Saturday' },
  { value: 'sunday', label: 'Sun', full: 'Sunday' }
];

const END_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'after', label: 'After' },
  { value: 'on', label: 'On Date' }
];

const RecurringMeetingSection = ({ formData, setFormData, userPermissions, onPreview }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [isRecurring, setIsRecurring] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDates, setPreviewDates] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Check permission
  const hasRecurringPermission = userPermissions?.includes('meeting:create_recurring') || 
                                  userPermissions?.includes('meeting:create') ||
                                  userPermissions?.includes('*');

  // Initialize recurrence data when toggled
  useEffect(() => {
    if (isRecurring && !formData.recurrence) {
      setFormData(prev => ({
        ...prev,
        recurrence: {
          type: 'weekly',
          interval: 1,
          days: ['monday', 'wednesday', 'friday'],
          day_of_month: null,
          end_date: null,
          max_occurrences: null,
          end_option: 'never'
        }
      }));
    }
  }, [isRecurring, formData.recurrence, setFormData]);

  // Fetch preview when recurrence changes
  useEffect(() => {
    if (isRecurring && showPreview && formData.recurrence) {
      fetchPreview();
    }
  }, [formData.recurrence, isRecurring, showPreview]);

  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      // Call API to preview occurrences
      const response = await api.post('/recurring-meetings/preview', {
        recurrence_type: formData.recurrence?.type,
        recurrence_interval: formData.recurrence?.interval,
        recurrence_days: formData.recurrence?.days,
        recurrence_day_of_month: formData.recurrence?.day_of_month,
        start_date: formData.start_time || new Date(),
        end_date: formData.recurrence?.end_date,
        max_occurrences: 10
      });
      setPreviewDates(response.data || []);
    } catch (error) {
      console.error('Error fetching preview:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const updateRecurrence = (field, value) => {
    setFormData(prev => ({
      ...prev,
      recurrence: {
        ...prev.recurrence,
        [field]: value
      }
    }));
  };

  const handleRecurrenceTypeChange = (type) => {
    updateRecurrence('type', type);
    // Reset days for weekly if changing from monthly
    if (type === 'weekly' && !formData.recurrence?.days) {
      updateRecurrence('days', ['monday', 'wednesday', 'friday']);
    }
    if (type === 'monthly' && !formData.recurrence?.day_of_month) {
      updateRecurrence('day_of_month', 1);
    }
  };

  const toggleDay = (day) => {
    const currentDays = formData.recurrence?.days || [];
    if (currentDays.includes(day)) {
      updateRecurrence('days', currentDays.filter(d => d !== day));
    } else {
      updateRecurrence('days', [...currentDays, day]);
    }
  };

  if (!hasRecurringPermission) return null;

  return (
    <Box sx={{ mt: 3 }}>
      {/* Recurring Toggle */}
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 2, 
          bgcolor: isRecurring ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
          borderColor: isRecurring ? theme.palette.primary.main : 'divider',
          transition: 'all 0.3s'
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <FormControlLabel
            control={
              <Switch
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Stack direction="row" alignItems="center" spacing={1}>
                <RepeatIcon color={isRecurring ? 'primary' : 'action'} />
                <Typography variant="body1" fontWeight={isRecurring ? 600 : 400}>
                  Make this a recurring meeting
                </Typography>
                {isRecurring && (
                  <Chip 
                    label="Active" 
                    size="small" 
                    color="success" 
                    sx={{ ml: 1 }}
                  />
                )}
              </Stack>
            }
          />
          {isRecurring && (
            <Tooltip title="Preview occurrences">
              <IconButton 
                size="small" 
                onClick={() => setShowPreview(!showPreview)}
                color={showPreview ? 'primary' : 'default'}
              >
                <PreviewIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {/* Recurrence Configuration */}
        <Collapse in={isRecurring}>
          <Box sx={{ mt: 3 }}>
            <Grid container spacing={3}>
              {/* Recurrence Type */}
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Recurrence Pattern</InputLabel>
                  <Select
                    value={formData.recurrence?.type || 'weekly'}
                    onChange={(e) => handleRecurrenceTypeChange(e.target.value)}
                    label="Recurrence Pattern"
                  >
                    {RECURRENCE_TYPES.map(type => (
                      <MenuItem key={type.value} value={type.value}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <span>{type.icon}</span>
                          <span>{type.label}</span>
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {type.description}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Interval */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Repeat every"
                  value={formData.recurrence?.interval || 1}
                  onChange={(e) => updateRecurrence('interval', parseInt(e.target.value) || 1)}
                  InputProps={{
                    inputProps: { min: 1, max: 365 },
                    endAdornment: (
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        {formData.recurrence?.type === 'daily' && 'day(s)'}
                        {(formData.recurrence?.type === 'weekly' || formData.recurrence?.type === 'biweekly') && 'week(s)'}
                        {formData.recurrence?.type === 'monthly' && 'month(s)'}
                        {formData.recurrence?.type === 'quarterly' && 'quarter(s)'}
                        {formData.recurrence?.type === 'yearly' && 'year(s)'}
                      </Typography>
                    )
                  }}
                />
              </Grid>

              {/* Weekly: Day Selection */}
              {(formData.recurrence?.type === 'weekly' || formData.recurrence?.type === 'biweekly') && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Repeat on
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {WEEK_DAYS.map(day => (
                      <ToggleButton
                        key={day.value}
                        value={day.value}
                        selected={formData.recurrence?.days?.includes(day.value)}
                        onChange={() => toggleDay(day.value)}
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: 2,
                          '&.Mui-selected': {
                            bgcolor: theme.palette.primary.main,
                            color: 'white',
                            '&:hover': {
                              bgcolor: theme.palette.primary.dark,
                            }
                          }
                        }}
                      >
                        <Stack direction="column" alignItems="center">
                          <Typography variant="caption">{day.label}</Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {day.full.substring(0, 3)}
                          </Typography>
                        </Stack>
                      </ToggleButton>
                    ))}
                  </Stack>
                  {(!formData.recurrence?.days || formData.recurrence?.days.length === 0) && (
                    <FormHelperText error>Please select at least one day</FormHelperText>
                  )}
                </Grid>
              )}

              {/* Monthly: Day of Month */}
              {formData.recurrence?.type === 'monthly' && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Day of month"
                    value={formData.recurrence?.day_of_month || 1}
                    onChange={(e) => updateRecurrence('day_of_month', parseInt(e.target.value) || 1)}
                    InputProps={{
                      inputProps: { min: 1, max: 31 }
                    }}
                    helperText="1-31 (if 31 not available, uses last day of month)"
                  />
                </Grid>
              )}

              {/* End Options */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" gutterBottom>
                  End recurrence
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl>
                    <Select
                      value={formData.recurrence?.end_option || 'never'}
                      onChange={(e) => updateRecurrence('end_option', e.target.value)}
                      size="small"
                      sx={{ minWidth: 120 }}
                    >
                      {END_OPTIONS.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {formData.recurrence?.end_option === 'after' && (
                    <TextField
                      type="number"
                      label="Number of occurrences"
                      value={formData.recurrence?.max_occurrences || ''}
                      onChange={(e) => updateRecurrence('max_occurrences', parseInt(e.target.value) || 0)}
                      size="small"
                      sx={{ width: 200 }}
                      InputProps={{ inputProps: { min: 1, max: 999 } }}
                    />
                  )}

                  {formData.recurrence?.end_option === 'on' && (
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        label="End date"
                        value={formData.recurrence?.end_date}
                        onChange={(date) => updateRecurrence('end_date', date)}
                        slotProps={{ textField: { size: 'small', sx: { width: 200 } } }}
                      />
                    </LocalizationProvider>
                  )}
                </Stack>
              </Grid>
            </Grid>

            {/* Preview Section */}
            <Collapse in={showPreview}>
              <Alert 
                severity="info" 
                sx={{ mt: 3 }}
                action={
                  <IconButton
                    size="small"
                    onClick={() => setShowPreview(false)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                }
              >
                <Typography variant="subtitle2" gutterBottom>
                  Upcoming Occurrences (Preview)
                </Typography>
                {loadingPreview ? (
                  <Typography variant="body2">Loading preview...</Typography>
                ) : previewDates.length > 0 ? (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {previewDates.map((date, index) => (
                      <Stack key={index} direction="row" alignItems="center" spacing={1}>
                        <Badge badgeContent={index + 1} color="primary" />
                        <CalendarIcon fontSize="small" />
                        <Typography variant="body2">
                          {new Date(date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </Typography>
                      </Stack>
                    ))}
                    {previewDates.length === 10 && (
                      <Typography variant="caption" color="text.secondary">
                        Showing first 10 occurrences...
                      </Typography>
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2">No occurrences to preview</Typography>
                )}
              </Alert>
            </Collapse>

            {/* Info Alert */}
            <Alert severity="info" sx={{ mt: 3 }} icon={<InfoIcon />}>
              <Typography variant="body2">
                <strong>About Recurring Meetings:</strong> This will create a series of meetings based on the pattern above.
                Each occurrence will be created as a separate meeting. You can modify individual occurrences later.
              </Typography>
            </Alert>
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default RecurringMeetingSection;