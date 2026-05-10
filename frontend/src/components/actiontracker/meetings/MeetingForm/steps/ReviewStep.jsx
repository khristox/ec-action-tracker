import React from 'react';
import {
  Stack, Alert, Card, CardContent, Typography, Grid, Box, Divider,
  Chip, Button, CircularProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Repeat as RepeatIcon,
  Update as UpdateIcon,
  Save as SaveIcon,
  Business as BusinessIcon,
  Domain as DepartmentIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Event as EventIcon
} from '@mui/icons-material';
import { formatRecurrenceSummary } from '../utils';

export const ReviewStep = ({
  formData,
  meetingParticipants,
  chairpersonName,
  gpsEnabled,
  isRecurring,
  recurrence,
  visibility,
  restrictedDepartmentId,
  restrictedDepartmentName, // Add this prop - pass the department name directly
  isEditMode,
  apiLoading,
  handleSubmit
}) => {
  return (
    <Stack spacing={2}>
      <Alert severity="info" icon={<CheckCircleIcon />}>
        {isEditMode ? 'Review meeting details before updating' : 'Review meeting details before creating'}
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Meeting Information
          </Typography>
          
          <Grid container spacing={1.5}>
            {/* Title */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2">
                <strong>Title:</strong> {formData.title || '—'}
              </Typography>
            </Grid>
            
            {/* Chairperson */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2">
                <strong>Chairperson:</strong> {chairpersonName || 'Not selected'}
              </Typography>
            </Grid>
            
            {/* Secretary */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="secondary.main">
                <strong>Secretary:</strong> {formData.secretary_name || 'Not selected'}
              </Typography>
            </Grid>
            
            {/* Location */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2">
                <strong>Location:</strong> {formData.location_text || 'Not specified'}
              </Typography>
            </Grid>
            
            {/* Location Details */}
            {formData.location_details && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2">
                  <strong>Location Type:</strong> {formData.location_details.location_mode} – Level {formData.location_details.level}
                </Typography>
              </Grid>
            )}
            
            {/* Date & Time */}
            {formData.meeting_date && formData.start_time && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2">
                  <strong>Date & Time:</strong> {formData.meeting_date?.toLocaleDateString()} at {formData.start_time?.toLocaleTimeString()}
                  {formData.end_time && ` – ${formData.end_time?.toLocaleTimeString()}`}
                </Typography>
              </Grid>
            )}
            
            {/* GPS */}
            {gpsEnabled && formData.gps_latitude && formData.gps_longitude && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2">
                  <strong>GPS:</strong> {formData.gps_latitude}, {formData.gps_longitude}
                </Typography>
              </Grid>
            )}
            
            {/* Visibility */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2">
                <strong>Visibility:</strong>{' '}
                <Chip 
                  label={visibility === 'open' ? 'Open to All' : 'Department Restricted'} 
                  size="small"
                  color={visibility === 'open' ? 'success' : 'warning'}
                  icon={visibility === 'open' ? <BusinessIcon /> : <DepartmentIcon />}
                  sx={{ ml: 1 }}
                />
              </Typography>
            </Grid>
            
            {/* Restricted Department - Shows name from passed prop */}
            {visibility === 'department' && restrictedDepartmentId && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2">
                  <strong>Restricted Department:</strong>{' '}
                  <Chip 
                    label={restrictedDepartmentName || restrictedDepartmentId} 
                    size="small"
                    color="warning"
                    variant="outlined"
                    icon={<DepartmentIcon />}
                  />
                </Typography>
              </Grid>
            )}
            
            {/* Recurrence */}
            {isRecurring && recurrence && (
              <Grid size={{ xs: 12 }}>
                <Chip
                  icon={<RepeatIcon />}
                  label={formatRecurrenceSummary(recurrence)}
                  color="primary"
                  size="medium"
                />
                {recurrence.days && recurrence.days.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    On: {recurrence.days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                  </Typography>
                )}
              </Grid>
            )}
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Agenda Preview */}
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Agenda Preview
          </Typography>
          <Box sx={{ maxHeight: 300, overflow: 'auto', fontSize: '0.875rem', p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            {formData.agenda && formData.agenda !== '<p></p>' ? (
              <div dangerouslySetInnerHTML={{ __html: formData.agenda }} />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No agenda provided
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Participants */}
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Participants ({meetingParticipants.length})
          </Typography>
          <Box sx={{ pl: 2, mt: 1, maxHeight: 150, overflow: 'auto' }}>
            {meetingParticipants.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No participants added yet
              </Typography>
            ) : (
              meetingParticipants.slice(0, 10).map(p => (
                <Box key={p.id} sx={{ mb: 0.5 }}>
                  <Typography variant="body2">
                    • {p.name}
                    {p.is_chairperson && (
                      <Chip label="Chairperson" size="small" color="primary" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />
                    )}
                    {p.name === formData.secretary_name && (
                      <Chip label="Secretary" size="small" color="secondary" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />
                    )}
                  </Typography>
                </Box>
              ))
            )}
            {meetingParticipants.length > 10 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                …and {meetingParticipants.length - 10} more
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button
        variant="contained"
        size="large"
        onClick={handleSubmit}
        startIcon={isEditMode ? <UpdateIcon /> : <SaveIcon />}
        disabled={apiLoading}
        sx={{ py: 1.5, bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
      >
        {apiLoading ? <CircularProgress size={24} /> : (isEditMode ? 'Update Meeting' : 'Create Meeting')}
      </Button>
    </Stack>
  );
};

export default ReviewStep;