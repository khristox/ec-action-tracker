// src/components/meetings/MeetingForm/steps/MeetingDetailsStep.jsx
//
// NOTE: access control (visibility + department) has been removed from this
// step. It now lives solely in AccessControlStep (wizard step 2). Rendering it
// in two places bound it to the same parent state twice, so whichever instance
// mounted last could overwrite the other's selection.
import React, { useState, useCallback, useMemo } from 'react';
import {
  Stack,
  TextField,
  Grid,
  Card,
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
  Tooltip,
} from '@mui/material';
import {
  Event as EventIcon,
  MyLocation as MyLocationIcon,
  GpsFixed as GpsFixedIcon,
  GpsNotFixed as GpsNotFixedIcon,
  Info as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import RichTextEditor from '../../../../actiontracker/meetings/components/RichTextEditor';
import { LocationSearch } from '../components/LocationSearch';

export const MeetingDetailsStep = ({
  formData,
  setFormData,
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
  isMobile,
}) => {
  const [showGpsDetails, setShowGpsDetails] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [gpsSupported] = useState(
    () => typeof navigator !== 'undefined' && Boolean(navigator.geolocation)
  );

  const getCurrentLocation = useCallback(() => {
    if (!gpsSupported) {
      setGpsError('Location services are not available in this browser. Enter coordinates manually below.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          gps_latitude: pos.coords.latitude.toFixed(6),
          gps_longitude: pos.coords.longitude.toFixed(6),
        }));
        setGpsEnabled(true);
        setGpsLoading(false);
        setShowGpsDetails(true);
      },
      (err) => {
        let message;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location permission is blocked. Allow it in your browser settings, or enter coordinates manually.';
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'Your location could not be determined. Enter coordinates manually.';
            break;
          case err.TIMEOUT:
            message = 'The location request timed out. Try again.';
            break;
          default:
            message = 'The location request failed. Enter coordinates manually.';
        }
        setGpsError(message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [gpsSupported, setFormData, setGpsEnabled]);

  const handleGpsToggle = useCallback(
    (e) => {
      const enabled = e.target.checked;
      setGpsEnabled(enabled);
      if (!enabled) {
        setFormData((prev) => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
        setGpsError(null);
      } else if (gpsSupported && !formData.gps_latitude) {
        getCurrentLocation();
      }
    },
    [gpsSupported, formData.gps_latitude, setGpsEnabled, setFormData, getCurrentLocation]
  );

  const clearGpsCoordinates = useCallback(() => {
    setFormData((prev) => ({ ...prev, gps_latitude: '', gps_longitude: '' }));
    setGpsEnabled(false);
    setShowGpsDetails(false);
  }, [setFormData, setGpsEnabled]);

  const isGpsValid = useMemo(
    () =>
      Boolean(formData.gps_latitude) &&
      Boolean(formData.gps_longitude) &&
      !Number.isNaN(parseFloat(formData.gps_latitude)) &&
      !Number.isNaN(parseFloat(formData.gps_longitude)),
    [formData.gps_latitude, formData.gps_longitude]
  );

  const endsBeforeStart =
    Boolean(formData.start_time) &&
    Boolean(formData.end_time) &&
    formData.end_time <= formData.start_time;

  return (
    <Stack spacing={2.5} sx={{ textAlign: 'left', alignItems: 'stretch' }}>
      {/* Meeting Title */}
      <TextField
        fullWidth
        label="Meeting Title"
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
            ),
          },
        }}
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
        helperText="Optional. Adds context for people receiving the invite."
      />

      {/* Date and Time */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <DatePicker
            label="Meeting Date"
            value={formData.meeting_date}
            onChange={handleDateChange}
            disabled={apiLoading}
            slotProps={{
              textField: { fullWidth: true, required: true },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TimePicker
            label="Start Time"
            value={formData.start_time}
            onChange={handleStartTimeChange}
            disabled={apiLoading}
            slotProps={{
              textField: { fullWidth: true, required: true },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TimePicker
            label="End Time"
            value={formData.end_time}
            onChange={handleEndTimeChange}
            disabled={apiLoading}
            slotProps={{
              textField: {
                fullWidth: true,
                error: endsBeforeStart,
                helperText: endsBeforeStart ? 'End time must be after the start time' : '',
              },
            }}
          />
        </Grid>
      </Grid>

      {/* Location Search */}
      <LocationSearch
        value={formData.location_details}
        onChange={handleLocationSelect}
        onClear={() => handleLocationSelect(null)}
      />

      {/* GPS Coordinates */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardActionArea onClick={() => setShowGpsDetails((prev) => !prev)}>
          <Box
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
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
              onClick={(e) => e.stopPropagation()}
              disabled={apiLoading}
              inputProps={{ 'aria-label': 'Attach GPS coordinates' }}
            />
          </Box>
        </CardActionArea>

        <Collapse in={showGpsDetails && gpsEnabled}>
          <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={gpsLoading ? null : <MyLocationIcon />}
                  onClick={getCurrentLocation}
                  disabled={gpsLoading || !gpsSupported || apiLoading}
                  sx={{ minWidth: 180 }}
                >
                  {gpsLoading ? 'Locating…' : 'Use current location'}
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
                  This browser does not support location services. Enter coordinates manually.
                </Alert>
              )}

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Latitude"
                    value={formData.gps_latitude}
                    onChange={(e) => {
                      const next = e.target.value;
                      setFormData((prev) => ({ ...prev, gps_latitude: next }));
                      if (next && formData.gps_longitude) setGpsEnabled(true);
                    }}
                    size="small"
                    placeholder="0.3136"
                    disabled={apiLoading}
                    helperText="Example: 0.3136"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Longitude"
                    value={formData.gps_longitude}
                    onChange={(e) => {
                      const next = e.target.value;
                      setFormData((prev) => ({ ...prev, gps_longitude: next }));
                      if (formData.gps_latitude && next) setGpsEnabled(true);
                    }}
                    size="small"
                    placeholder="32.5811"
                    disabled={apiLoading}
                    helperText="Example: 32.5811"
                  />
                </Grid>
              </Grid>

              {/* Alert has no `size` prop — it was being forwarded to the DOM. */}
              {isGpsValid && (
                <Alert severity="success" variant="outlined">
                  Coordinates set: {formData.gps_latitude}, {formData.gps_longitude}
                </Alert>
              )}
            </Stack>
          </Box>
        </Collapse>
      </Card>

      {/* Agenda */}
      <Box>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ textAlign: 'left' }}>
          Agenda
        </Typography>

        <Box
          sx={{
            width: '100%',
            '& .ProseMirror, & .ProseMirror *, & .modern-editor, & .tiptap, & [contenteditable="true"]': {
              textAlign: 'left !important',
            },
            '& .ProseMirror-focused': { outline: 'none' },
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