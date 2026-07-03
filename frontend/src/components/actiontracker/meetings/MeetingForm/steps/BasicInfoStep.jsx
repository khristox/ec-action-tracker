// src/components/meetings/MeetingForm/steps/BasicInfoStep.jsx

import React, { useState } from 'react';
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
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { VisibilitySelector } from '../components/VisibilitySelector';
import { DepartmentSelector } from '../components/DepartmentSelector';

export const BasicInfoStep = ({
  formData,
  setFormData,
  visibility,
  setVisibility,
  restrictedDepartmentId,
  restrictedDepartmentName,
  handleRestrictedDepartmentChange,
  handleClearRestrictedDepartment,
  isMobile,
  apiLoading,
  handleChange,
  handleDateChange,
  handleStartTimeChange,
  handleEndTimeChange,
  organizationId,
  setOrganizationId,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const isRestricted = visibility === 'department';

  // Check if all required fields are filled
  const isTitleFilled = formData?.title?.trim()?.length > 0;
  const isDateFilled = !!formData?.meeting_date;
  const isStartTimeFilled = !!formData?.start_time;

  return (
    <Box sx={{ width: '100%' }}>
      <Stack spacing={2.5}>
        {/* Meeting Title */}
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
          }}
        >
          <Stack spacing={2}>
            <Typography 
              variant="subtitle2" 
              fontWeight={600}
              sx={{
                color: isLight ? '#1a1a2e' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <TitleIcon sx={{ fontSize: 18, color: '#667eea' }} />
              Meeting Details
              {isTitleFilled && (
                <Chip 
                  label="✓ Title set" 
                  size="small" 
                  color="success" 
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              )}
            </Typography>

            <TextField
              required
              fullWidth
              label="Meeting Title *"
              name="title"
              value={formData.title || ''}
              onChange={handleChange}
              placeholder="Enter a clear, descriptive meeting title"
              size="small"
              disabled={apiLoading}
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
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <TitleIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: isTitleFilled && (
                    <InputAdornment position="end">
                      <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              fullWidth
              label="Description (Optional)"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              placeholder="Add context, objectives, or background information for this meeting"
              multiline
              rows={2}
              size="small"
              disabled={apiLoading}
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
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', pt: 1 }}>
                      <DescriptionIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Stack>
        </Paper>

        {/* Date & Time */}
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
          }}
        >
          <Typography 
            variant="subtitle2" 
            fontWeight={600}
            sx={{
              color: isLight ? '#1a1a2e' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
            }}
          >
            <EventIcon sx={{ fontSize: 18, color: '#667eea' }} />
            Schedule
            {isDateFilled && isStartTimeFilled && (
              <Chip 
                label="✓ Scheduled" 
                size="small" 
                color="success" 
                variant="outlined"
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            )}
          </Typography>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DatePicker
                label="Meeting Date *"
                value={formData.meeting_date}
                onChange={handleDateChange}
                disabled={apiLoading}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    size: 'small',
                    error: !isDateFilled && formData?.meeting_date !== undefined,
                    helperText: !isDateFilled && formData?.meeting_date !== undefined ? 'Date is required' : '',
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
                value={formData.start_time}
                onChange={handleStartTimeChange}
                disabled={apiLoading}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    size: 'small',
                    error: !isStartTimeFilled && formData?.start_time !== undefined,
                    helperText: !isStartTimeFilled && formData?.start_time !== undefined ? 'Start time is required' : '',
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
                value={formData.end_time}
                onChange={handleEndTimeChange}
                disabled={apiLoading}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                    error: formData?.start_time && formData?.end_time && formData.end_time <= formData.start_time,
                    helperText: formData?.start_time && formData?.end_time && formData.end_time <= formData.start_time
                      ? 'End time must be after start time'
                      : '',
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

          {isDateFilled && isStartTimeFilled && formData?.end_time && (
            <Fade in timeout={400}>
              <Typography 
                variant="caption" 
                sx={{ 
                  mt: 1.5, 
                  display: 'block',
                  color: isLight ? '#4a4a6a' : '#aaaaaa',
                  bgcolor: isLight ? alpha(theme.palette.success.main, 0.06) : alpha(theme.palette.success.main, 0.12),
                  p: 0.75,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: isLight ? alpha(theme.palette.success.main, 0.15) : alpha(theme.palette.success.main, 0.2),
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  <span>
                    Meeting scheduled for {formData.meeting_date ? format(new Date(formData.meeting_date), 'PPP') : ''} 
                    at {formData.start_time ? format(new Date(formData.start_time), 'p') : ''}
                    {formData.end_time ? ` - ${format(new Date(formData.end_time), 'p')}` : ''}
                  </span>
                </Stack>
              </Typography>
            </Fade>
          )}
        </Paper>

        {/* Department Access Control */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            bgcolor: isRestricted 
              ? (isLight ? alpha(theme.palette.warning.main, 0.04) : alpha(theme.palette.warning.main, 0.08))
              : (isLight ? 'transparent' : 'transparent'),
            border: '1px solid',
            borderColor: isRestricted 
              ? (isLight ? alpha(theme.palette.warning.main, 0.2) : alpha(theme.palette.warning.main, 0.3))
              : (isLight ? alpha(theme.palette.divider, 0.5) : alpha(theme.palette.divider, 0.1)),
            transition: 'all 0.3s ease',
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <BusinessIcon sx={{ 
                  fontSize: 18, 
                  color: isRestricted ? 'warning.main' : (isLight ? '#6b6b8a' : '#888888'),
                }} />
                <Typography 
                  variant="subtitle2" 
                  fontWeight={600}
                  sx={{
                    color: isRestricted ? (isLight ? 'warning.dark' : 'warning.light') : (isLight ? '#1a1a2e' : '#ffffff'),
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
              disabled={apiLoading}
              isLight={isLight}
            />

            {isRestricted && (
              <Fade in timeout={300}>
                <Box>
                  <DepartmentSelector
                    value={restrictedDepartmentId}
                    onChange={handleRestrictedDepartmentChange}
                    disabled={apiLoading}
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
                p: 1,
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
              <InfoIcon sx={{ fontSize: 16, color: isRestricted ? 'warning.main' : 'info.main', mt: 0.25 }} />
              <Typography variant="caption" sx={{ color: isLight ? '#4a4a6a' : '#aaaaaa' }}>
                {isRestricted 
                  ? '🔒 This meeting will be visible only to members of the selected department.'
                  : '🌐 This meeting will be open to all departments. Select "Restricted to Department" to limit access.'
                }
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
};

export default React.memo(BasicInfoStep);