// src/components/meetings/MeetingForm/steps/ReviewStep.jsx

import React, { useMemo } from 'react';
import {
  Stack,
  Alert,
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Divider,
  Chip,
  Button,
  CircularProgress,
  Paper,
  alpha,
  useTheme,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Repeat as RepeatIcon,
  Update as UpdateIcon,
  Save as Save,
  Business as BusinessIcon,
  Domain as DepartmentIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Work as WorkIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  GpsFixed as GpsFixedIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Today as TodayIcon,
} from '@mui/icons-material';
import { formatRecurrenceSummary } from '../utils';

// ============================================================================
// Helper Functions - Safe Date/Time Formatting
// ============================================================================

const safeFormatDate = (value) => {
  if (!value) return 'Not set';
  
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  if (typeof value === 'string') {
    // If it's in YYYY-MM-DD format, parse as UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      // Create date as UTC (month is 0-indexed in JS)
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    }
    
    // Try to parse as ISO string
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { 
          weekday: 'short',
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    } catch {
      // Ignore
    }
  }
  
  return 'Invalid date';
};

const safeFormatTime = (value) => {
  if (!value) return 'Not set';
  
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  if (typeof value === 'string') {
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      const [hours, minutes] = value.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      }
    }
    
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      }
    } catch {
      // Ignore
    }
  }
  
  return 'Invalid time';
};

// ============================================================================
// Sub-Components
// ============================================================================

const InfoCard = ({ icon: Icon, title, children, color = 'primary', ...props }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        bgcolor: isLight 
          ? alpha(theme.palette[color].main, 0.03) 
          : alpha(theme.palette[color].main, 0.06),
        borderColor: isLight 
          ? alpha(theme.palette[color].main, 0.15) 
          : alpha(theme.palette[color].main, 0.2),
        ...props.sx,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
        <Icon sx={{ color: theme.palette[color].main, fontSize: 20 }} />
        <Typography variant="subtitle2" fontWeight={600} color={color}>
          {title}
        </Typography>
      </Stack>
      {children}
    </Paper>
  );
};

const InfoRow = ({ label, value, icon: Icon, color = 'text.primary', secondary = false }) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    {Icon && <Icon sx={{ fontSize: 16, color: 'text.secondary' }} />}
    <Typography variant="body2" component="span">
      <strong>{label}:</strong>
    </Typography>
    <Typography 
      variant="body2" 
      component="span"
      color={color}
      fontWeight={secondary ? 500 : 400}
    >
      {value || '—'}
    </Typography>
  </Stack>
);

const ParticipantChip = ({ label, color = 'primary' }) => (
  <Chip
    label={label}
    size="small"
    color={color}
    sx={{ 
      height: 20, 
      fontSize: '0.65rem',
      '& .MuiChip-label': { px: 0.5 }
    }}
  />
);

// ============================================================================
// Main Component
// ============================================================================

export const ReviewStep = ({
  formData,
  meetingParticipants,
  chairpersonName,
  gpsEnabled,
  isRecurring,
  recurrence,
  visibility,
  restrictedDepartmentId,
  restrictedDepartmentName,
  isEditMode,
  apiLoading,
  handleSubmit,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  // ==========================================================================
  // Memoized Values - Safe Date/Time
  // ==========================================================================

  const formattedDate = useMemo(
    () => safeFormatDate(formData?.meeting_date),
    [formData?.meeting_date]
  );

  const formattedStartTime = useMemo(
    () => safeFormatTime(formData?.start_time),
    [formData?.start_time]
  );

  const formattedEndTime = useMemo(
    () => safeFormatTime(formData?.end_time),
    [formData?.end_time]
  );

  const hasAgenda = useMemo(
    () => formData?.agenda && formData?.agenda !== '<p></p>' && formData?.agenda !== '',
    [formData?.agenda]
  );

  const isRestricted = visibility === 'department';

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Stack spacing={3}>
      {/* Header Alert */}
      <Alert 
        severity="info" 
        icon={<CheckCircleIcon />}
        sx={{
          borderRadius: 2,
          '& .MuiAlert-message': { width: '100%' }
        }}
      >
        <Typography variant="body2" fontWeight={500}>
          {isEditMode 
            ? 'Review meeting details before updating' 
            : 'Review meeting details before creating'
          }
        </Typography>
      </Alert>

      {/* Meeting Information Card */}
      <InfoCard icon={EventIcon} title="Meeting Information">
        <Grid container spacing={1.5}>
          {/* Title */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <InfoRow label="Title" value={formData.title || 'Not set'} />
          </Grid>

          {/* Chairperson */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <InfoRow 
              label="Chairperson" 
              value={chairpersonName || 'Not selected'} 
              color={chairpersonName !== 'Not selected' ? 'primary.main' : 'text.secondary'}
            />
          </Grid>

          {/* Secretary */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <InfoRow 
              label="Secretary" 
              value={formData.secretary_name || 'Not selected'} 
              color={formData.secretary_name ? 'secondary.main' : 'text.secondary'}
            />
          </Grid>

          {/* Platform */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <InfoRow 
              label="Platform" 
              value={formData.platform === 'physical' ? '📍 In-Person' : `💻 ${formData.platform || 'Not set'}`}
            />
          </Grid>

          {/* Date & Time */}
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
              <Typography variant="body2">
                <strong>Date & Time:</strong>
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {formattedDate} at {formattedStartTime}
                {formData?.end_time && (
                  <> – {formattedEndTime}</>
                )}
              </Typography>
              {formData?.end_time && (
                <Chip 
                  label={`Duration: ${formattedStartTime} - ${formattedEndTime}`}
                  size="small"
                  variant="outlined"
                  icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                />
              )}
            </Stack>
          </Grid>

          {/* Location */}
          <Grid size={{ xs: 12 }}>
            <InfoRow 
              label="Location" 
              value={formData?.location_text || 'Not specified'}
              icon={LocationIcon}
            />
          </Grid>

          {/* Location Details */}
          {formData?.location_details && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                Type: {formData.location_details.location_mode} – Level {formData.location_details.level}
                {formData.location_details.code && ` (${formData.location_details.code})`}
              </Typography>
            </Grid>
          )}

          {/* Meeting Link */}
          {formData?.meeting_link && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2">
                <strong>Meeting Link:</strong>{' '}
                <a 
                  href={formData.meeting_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: theme.palette.primary.main,
                    textDecoration: 'none',
                    wordBreak: 'break-all'
                  }}
                >
                  {formData.meeting_link}
                </a>
              </Typography>
            </Grid>
          )}

          {/* GPS */}
          {gpsEnabled && formData?.gps_latitude && formData?.gps_longitude && (
            <Grid size={{ xs: 12 }}>
              <InfoRow 
                label="GPS" 
                value={`${formData.gps_latitude}, ${formData.gps_longitude}`}
                icon={GpsFixedIcon}
              />
            </Grid>
          )}
        </Grid>

        {/* Visibility Section */}
        <Divider sx={{ my: 2 }} />

        <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
          <Typography variant="body2">
            <strong>Visibility:</strong>
          </Typography>
          <Chip 
            label={isRestricted ? '🔒 Restricted to Department' : '🌐 Open to All'}
            color={isRestricted ? 'warning' : 'success'}
            size="small"
            icon={isRestricted ? <LockIcon /> : <PublicIcon />}
          />
          {isRestricted && restrictedDepartmentName && (
            <Chip 
              label={`Department: ${restrictedDepartmentName}`}
              size="small"
              variant="outlined"
              color="warning"
              icon={<DepartmentIcon />}
            />
          )}
        </Stack>

        {/* Recurrence */}
        {isRecurring && recurrence && (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
              <Chip
                icon={<RepeatIcon />}
                label={formatRecurrenceSummary(recurrence)}
                color="primary"
                size="medium"
              />
              {recurrence.days && recurrence.days.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  On: {recurrence.days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                </Typography>
              )}
              {recurrence.end_option === 'after' && recurrence.max_occurrences && (
                <Typography variant="caption" color="text.secondary">
                  • Ends after {recurrence.max_occurrences} occurrences
                </Typography>
              )}
              {recurrence.end_option === 'on' && recurrence.end_date && (
                <Typography variant="caption" color="text.secondary">
                  • Ends on {safeFormatDate(recurrence.end_date)}
                </Typography>
              )}
            </Stack>
          </>
        )}
      </InfoCard>

      {/* Agenda Preview */}
      <InfoCard icon={DescriptionIcon} title="Agenda Preview" color="info">
        <Box 
          sx={{ 
            maxHeight: 300, 
            overflow: 'auto', 
            p: 2,
            borderRadius: 1,
            bgcolor: isLight ? 'grey.50' : 'grey.900',
            border: 1,
            borderColor: isLight ? 'grey.200' : 'grey.800',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            '& ul, & ol': { pl: 2 },
            '& p': { my: 0.5 }
          }}
        >
          {hasAgenda ? (
            <div dangerouslySetInnerHTML={{ __html: formData.agenda }} />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No agenda provided
            </Typography>
          )}
        </Box>
      </InfoCard>

      {/* Participants */}
      <InfoCard icon={PeopleIcon} title={`Participants (${meetingParticipants.length})`} color="success">
        {meetingParticipants.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No participants added yet
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 200, overflow: 'auto', py: 0 }}>
            {meetingParticipants.slice(0, 15).map((p, index) => (
              <React.Fragment key={p.id || index}>
                <ListItem sx={{ px: 0 }}>
                  <ListItemAvatar sx={{ minWidth: 32 }}>
                    <Avatar 
                      sx={{ 
                        width: 28, 
                        height: 28, 
                        fontSize: 12,
                        bgcolor: p.is_chairperson ? 'primary.main' : 'grey.400'
                      }}
                    >
                      {p.name?.charAt(0)?.toUpperCase() || 'P'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                        <Typography variant="body2" fontWeight={p.is_chairperson ? 600 : 400}>
                          {p.name}
                        </Typography>
                        {p.is_chairperson && <ParticipantChip label="Chairperson" color="primary" />}
                        {p.name === formData?.secretary_name && <ParticipantChip label="Secretary" color="secondary" />}
                      </Stack>
                    }
                    secondary={
                      <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 0.25 }}>
                        {p.email && (
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 12 }} /> {p.email}
                          </Typography>
                        )}
                        {p.telephone && (
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon sx={{ fontSize: 12 }} /> {p.telephone}
                          </Typography>
                        )}
                        {p.organization && (
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <WorkIcon sx={{ fontSize: 12 }} /> {p.organization}
                          </Typography>
                        )}
                      </Stack>
                    }
                  />
                </ListItem>
                {index < Math.min(meetingParticipants.length, 15) - 1 && <Divider component="li" sx={{ my: 0.5 }} />}
              </React.Fragment>
            ))}
            {meetingParticipants.length > 15 && (
              <ListItem sx={{ px: 0 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  …and {meetingParticipants.length - 15} more participants
                </Typography>
              </ListItem>
            )}
          </List>
        )}
      </InfoCard>

      {/* Summary Section - Quick Stats */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: isLight ? alpha(theme.palette.primary.main, 0.03) : alpha(theme.palette.primary.main, 0.06),
          borderColor: isLight ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.primary.main, 0.2),
        }}
      >
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <TodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Date: <strong>{formattedDate}</strong>
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AccessTimeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Time: <strong>{formattedStartTime}</strong>
              {formData?.end_time && ` - ${formattedEndTime}`}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PeopleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Participants: <strong>{meetingParticipants.length}</strong>
            </Typography>
          </Stack>
          {isRecurring && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <RepeatIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                Recurring: <strong>{recurrence?.type || 'Yes'}</strong>
              </Typography>
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Submit Button */}
{/*       <Button
        variant="contained"
        size="large"
        onClick={handleSubmit}
        startIcon={isEditMode ? <UpdateIcon /> : <Save />}
        disabled={apiLoading}
        sx={{ 
          py: 1.5, 
          borderRadius: 2,
          bgcolor: '#7C3AED', 
          '&:hover': { bgcolor: '#6D28D9' },
          '&.Mui-disabled': { 
            bgcolor: isLight ? 'grey.400' : 'grey.700',
            color: isLight ? 'grey.600' : 'grey.400'
          }
        }}
        fullWidth
      >
        {apiLoading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          isEditMode ? 'Update Meeting' : 'Create Meeting'
        )}
      </Button> */}
    </Stack>
  );
};

export default ReviewStep;