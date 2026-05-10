// src/components/meetings/MeetingForm/steps/MeetingDetailsStep.jsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  Stack,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Box,
  Switch,
  Button,
  Typography,
  InputAdornment,
  Alert,
  Skeleton,
  Collapse,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Event as EventIcon,
  MyLocation as MyLocationIcon,
  GpsFixed as GpsFixedIcon,
  GpsNotFixed as GpsNotFixedIcon,
  Lock as LockIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import RichTextEditor from '../../../../actiontracker/meetings/components/RichTextEditor';
import { VisibilitySelector } from '../components/VisibilitySelector';
import { DepartmentSelector } from '../components/DepartmentSelector';
import { LocationSearch } from '../components/LocationSearch';

export const MeetingDetailsStep = ({
  formData,
  setFormData,
  visibility,
  setVisibility,
  restrictedDepartmentId,
  setRestrictedDepartmentId,
  gpsEnabled,
  setGpsEnabled,
  handleChange,
  handleDateChange,
  handleStartTimeChange,
  handleEndTimeChange,
  handleAgendaChange,
  handleLocationSelect,
  apiLoading,
  isEditMode,
  isMobile
}) => {
  const [showGpsDetails, setShowGpsDetails] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [gpsSupported] = useState(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return true;
    }
    console.warn('Geolocation is not supported by this browser');
    return false;
  });

  const getCurrentLocation = useCallback(() => {
    if (!gpsSupported) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          gps_latitude: pos.coords.latitude.toFixed(6),
          gps_longitude: pos.coords.longitude.toFixed(6)
        }));
        setGpsEnabled(true);
        setGpsLoading(false);
        setShowGpsDetails(true);
      },
      (err) => {
        let errorMessage = 'Failed to get location';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
          default:
            errorMessage = 'An unknown error occurred.';
        }
        setGpsError(errorMessage);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [gpsSupported, setFormData, setGpsEnabled]);

  const handleGpsToggle = useCallback((e) => {
    const enabled = e.target.checked;
    setGpsEnabled(enabled);
    if (!enabled) {
      setFormData(prev => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
      setGpsError(null);
    } else if (gpsSupported && !formData.gps_latitude) {
      getCurrentLocation();
    }
  }, [gpsSupported, formData.gps_latitude, setGpsEnabled, setFormData, getCurrentLocation]);

  const clearGpsCoordinates = useCallback(() => {
    setFormData(prev => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
    setGpsEnabled(false);
    setShowGpsDetails(false);
  }, [setFormData, setGpsEnabled]);

  const isGpsValid = useMemo(() => {
    return formData.gps_latitude && formData.gps_longitude &&
           !isNaN(parseFloat(formData.gps_latitude)) &&
           !isNaN(parseFloat(formData.gps_longitude));
  }, [formData.gps_latitude, formData.gps_longitude]);

  return (
    <Stack spacing={2.5} sx={{ textAlign: 'left', alignItems: 'stretch' }}>
      {/* Meeting Title */}
      <TextField
        fullWidth
        label="Meeting Title *"
        name="title"
        required
        value={formData.title}
        onChange={handleChange}
        disabled={apiLoading}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <EventIcon color="action" />
              </InputAdornment>
            )
          }
        }}
        helperText={!formData.title && formData.title !== '' ? 'Meeting title is required' : ''}
        error={!formData.title && formData.title !== ''}
      />

      {/* Description */}
      <TextField
        fullWidth
        label="Description"
        name="description"
        multiline
        rows={isMobile ? 2 : 3}
        value={formData.description}
        onChange={handleChange}
        disabled={apiLoading}
        helperText="Optional: Provide additional context for the meeting"
      />

      {/* Date and Time */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <DatePicker
            label="Meeting Date *"
            value={formData.meeting_date}
            onChange={handleDateChange}
            slotProps={{
              textField: {
                fullWidth: true,
                required: true,
                error: !formData.meeting_date,
                helperText: !formData.meeting_date ? 'Meeting date is required' : ''
              }
            }}
            disabled={apiLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TimePicker
            label="Start Time *"
            value={formData.start_time}
            onChange={handleStartTimeChange}
            slotProps={{
              textField: {
                fullWidth: true,
                required: true,
                error: !formData.start_time,
                helperText: !formData.start_time ? 'Start time is required' : ''
              }
            }}
            disabled={apiLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TimePicker
            label="End Time"
            value={formData.end_time}
            onChange={handleEndTimeChange}
            slotProps={{
              textField: {
                fullWidth: true,
                error: formData.start_time && formData.end_time && formData.end_time <= formData.start_time,
                helperText: formData.start_time && formData.end_time && formData.end_time <= formData.start_time
                  ? 'End time must be after start time'
                  : ''
              }
            }}
            disabled={apiLoading}
          />
        </Grid>
      </Grid>

      {/* Access & Visibility Card - Now only handles Restricted Department */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <LockIcon sx={{ fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Department Access Control
            </Typography>
            <Tooltip title="Restrict this meeting to specific department members">
              <HelpIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'help' }} />
            </Tooltip>
          </Stack>

          <VisibilitySelector
            value={visibility}
            onChange={setVisibility}
            disabled={apiLoading}
          />

          <Collapse in={visibility === 'department'}>
            <Box sx={{ mt: 2 }}>
              <DepartmentSelector
                value={restrictedDepartmentId}
                onChange={setRestrictedDepartmentId}
                disabled={apiLoading}
              />
            </Box>
          </Collapse>

          {/* Info message when no restriction is applied */}
          {visibility !== 'department' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                This meeting will be open to all departments. 
                Select "Restricted to Department" to limit access to specific department members.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Location Search */}
      <LocationSearch
        value={formData.location_details}
        onChange={handleLocationSelect}
        onClear={() => handleLocationSelect(null)}
      />

      {/* GPS Coordinates Card */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardActionArea onClick={() => setShowGpsDetails(!showGpsDetails)}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {isGpsValid ? (
                <GpsFixedIcon color="success" />
              ) : gpsEnabled ? (
                <GpsFixedIcon color="warning" />
              ) : (
                <GpsNotFixedIcon color="disabled" />
              )}
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  GPS Coordinates (Optional)
                </Typography>
                {isGpsValid && (
                  <Typography variant="caption" color="success.main">
                    Location captured
                  </Typography>
                )}
              </Box>
            </Stack>
            <Switch
              checked={gpsEnabled}
              onChange={handleGpsToggle}
              onClick={e => e.stopPropagation()}
              disabled={apiLoading}
            />
          </Box>
        </CardActionArea>

        <Collapse in={showGpsDetails && gpsEnabled}>
          <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  size="small"
                  variant="contained"
                  startIcon={gpsLoading ? <></> : <MyLocationIcon />}
                  onClick={getCurrentLocation}
                  disabled={gpsLoading || !gpsSupported || apiLoading}
                  sx={{ minWidth: 180 }}
                >
                  {gpsLoading ? 'Loading...' : 'Get Current Location'}
                </Button>
                {isGpsValid && (
                  <Tooltip title="Clear GPS coordinates">
                    <IconButton size="small" onClick={clearGpsCoordinates}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>

              {gpsError && (
                <Alert severity="warning" onClose={() => setGpsError(null)}>
                  {gpsError}
                </Alert>
              )}

              {!gpsSupported && (
                <Alert severity="info" icon={<InfoIcon />}>
                  Your browser doesn't support location services. You can manually enter coordinates.
                </Alert>
              )}

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Latitude"
                    value={formData.gps_latitude}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, gps_latitude: e.target.value }));
                      if (e.target.value && formData.gps_longitude) setGpsEnabled(true);
                    }}
                    size="small"
                    placeholder="e.g., 0.3136"
                    disabled={apiLoading}
                    helperText="Example: 0.3136"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Longitude"
                    value={formData.gps_longitude}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, gps_longitude: e.target.value }));
                      if (formData.gps_latitude && e.target.value) setGpsEnabled(true);
                    }}
                    size="small"
                    placeholder="e.g., 32.5811"
                    disabled={apiLoading}
                    helperText="Example: 32.5811"
                  />
                </Grid>
              </Grid>

              {isGpsValid && (
                <Alert severity="success" variant="outlined" size="small">
                  GPS coordinates: {formData.gps_latitude}, {formData.gps_longitude}
                </Alert>
              )}
            </Stack>
          </Box>
        </Collapse>
      </Card>

      {/* Rich Text Editor for Agenda */}
      <Box>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ textAlign: 'left' }}>
          Agenda
        </Typography>

        {/* Force left alignment container */}
        <Box
          sx={{
            width: '100%',
            '& .ProseMirror': {
              textAlign: 'left !important',
            },
            '& .ProseMirror p': {
              textAlign: 'left !important',
            },
            '& .ProseMirror h1, & .ProseMirror h2, & .ProseMirror h3': {
              textAlign: 'left !important',
            },
            '& .ProseMirror h4, & .ProseMirror h5, & .ProseMirror h6': {
              textAlign: 'left !important',
            },
            '& .ProseMirror ul, & .ProseMirror ol': {
              textAlign: 'left !important',
            },
            '& .ProseMirror li': {
              textAlign: 'left !important',
            },
            '& .ProseMirror blockquote': {
              textAlign: 'left !important',
            },
            '& .ProseMirror div': {
              textAlign: 'left !important',
            },
            '& .modern-editor': {
              textAlign: 'left !important',
            },
            '& .tiptap': {
              textAlign: 'left !important',
            },
            '& [contenteditable="true"]': {
              textAlign: 'left !important',
            },
            '& .ProseMirror-focused': {
              outline: 'none',
            }
          }}
        >
          {apiLoading ? (
            <Skeleton variant="rounded" height={300} animation="wave" />
          ) : (
            <RichTextEditor
              value={formData.agenda}
              onChange={handleAgendaChange}
              placeholder="Enter meeting agenda..."
              minHeight={300}
              readOnly={apiLoading}
            />
          )}
        </Box>

        {/* Optional: Show agenda summary when collapsed */}
        {formData.agenda && formData.agenda.length > 500 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {formData.agenda.replace(/<[^>]*>/g, '').length} characters · Rich text formatting supported
          </Typography>
        )}
      </Box>
    </Stack>
  );
};

export default MeetingDetailsStep;