// src/components/meetings/MeetingForm/MeetingForm.jsx
import React from 'react';
import {
  Box, Paper, Stepper, Step, StepLabel, Typography,
  AppBar, Toolbar, IconButton, Button, CircularProgress,
  useMediaQuery, Alert, Snackbar, Grid, Divider, Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowBack as ArrowBackIcon, Close as CloseIcon, Repeat as RepeatIcon } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { useMeetingForm } from './useMeetingForm';
import { STEPS } from './constants';
import { MeetingDetailsStep } from './steps/MeetingDetailsStep';
import { ParticipantsStep } from './steps/ParticipantsStep';
import { RecurrenceStep } from './steps/RecurrenceStep';
import { ReviewStep } from './steps/ReviewStep';
import { LoadingOverlay } from './components/LoadingOverlay';

const MeetingForm = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const {
    // Data state
    formData,
    activeStep,
    snackbar,
    formLoading,
    isSubmitting,
    submitMessage,
    recurrence,
    visibility,
    restrictedDepartmentId,
    restrictedDepartmentName,
    organizationId,
    gpsEnabled,
    meetingParticipants,
    chairpersonName,

    // UI state
    pageTitle,
    pageSubtitle,
    isRecurring,
    isValid,
    apiLoading,
    selectedUserIds,
    selectedParticipantIds,
    isEditMode,
    returnPath,
    mappingsLoading,

    // Setters
    setFormData,
    setSnackbar,
    setRecurrence,
    setVisibility,
    setRestrictedDepartmentId,
    setRestrictedDepartmentName,
    setOrganizationId,
    setGpsEnabled,

    // Handlers
    handleChange,
    handleDateChange,
    handleStartTimeChange,
    handleEndTimeChange,
    handleAgendaChange,
    handleLocationSelect,
    handleAddExistingUser,
    handleAddManualParticipant,
    handleAddFromList,
    handleSetChairperson,
    handleRemoveParticipant,
    handleNext,
    handleBack,
    handleCancel,
    handleSubmit,
    handleRestrictedDepartmentChange,
    handleClearRestrictedDepartment,
  } = useMeetingForm();

  // Show loading state
  if (formLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <LoadingOverlay open={isSubmitting} message={submitMessage} />

      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 10, sm: 4 } }}>
        {/* Mobile Header */}
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={handleCancel} aria-label="go back">
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="subtitle1" sx={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>
                {pageTitle}
              </Typography>
              <IconButton edge="end" onClick={handleCancel} aria-label="close">
                <CloseIcon />
              </IconButton>
            </Toolbar>
          </AppBar>
        )}

        {/* Full-width wrapper — no Container maxWidth cap */}
        <Box sx={{ width: '100%', px: { xs: 2, sm: 3, md: 4, lg: 6 }, py: { xs: 2, sm: 3 } }}>
          {/* Desktop Header */}
          {!isMobile && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h5" fontWeight={700} color="primary">
                  {pageTitle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {pageSubtitle}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloseIcon />}
                onClick={handleCancel}
                disabled={apiLoading}
              >
                Cancel
              </Button>
            </Box>
          )}

          <Grid container spacing={2.5}>
            {/* Main form column */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper sx={{ p: { xs: 2, sm: 2.5, md: 3 }, borderRadius: { xs: 2, md: 3 } }}>
                {/* Desktop Stepper — compact, single-line labels */}
                <Stepper activeStep={activeStep} sx={{ mb: 3, display: isMobile ? 'none' : 'flex' }}>
                  {STEPS.map((step, index) => (
                    <Step key={index}>
                      <StepLabel>
                        <Typography variant="body2" fontWeight={600}>{step.label}</Typography>
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>

                {/* Step 1: Meeting Details */}
                {activeStep === 0 && (
                  <MeetingDetailsStep
                    formData={formData}
                    setFormData={setFormData}
                    organizationId={organizationId}
                    setOrganizationId={setOrganizationId}
                    visibility={visibility}
                    setVisibility={setVisibility}
                    restrictedDepartmentId={restrictedDepartmentId}
                    setRestrictedDepartmentId={handleRestrictedDepartmentChange}
                    gpsEnabled={gpsEnabled}
                    setGpsEnabled={setGpsEnabled}
                    handleChange={handleChange}
                    handleDateChange={handleDateChange}
                    handleStartTimeChange={handleStartTimeChange}
                    handleEndTimeChange={handleEndTimeChange}
                    handleAgendaChange={handleAgendaChange}
                    handleLocationSelect={handleLocationSelect}
                    apiLoading={apiLoading}
                    isEditMode={isEditMode}
                    isMobile={isMobile}
                  />
                )}

                {/* Step 2: Participants */}
                {activeStep === 1 && (
                  <ParticipantsStep
                    meetingParticipants={meetingParticipants}
                    selectedUserIds={selectedUserIds}
                    selectedParticipantIds={selectedParticipantIds}
                    formData={formData}
                    handleChange={handleChange}
                    handleAddExistingUser={handleAddExistingUser}
                    handleAddManualParticipant={handleAddManualParticipant}
                    handleAddFromList={handleAddFromList}
                    handleRemoveParticipant={handleRemoveParticipant}
                    handleSetChairperson={handleSetChairperson}
                    apiLoading={apiLoading}
                  />
                )}

                {/* Step 3: Recurrence */}
                {activeStep === 2 && (
                  <RecurrenceStep
                    recurrence={recurrence}
                    setRecurrence={setRecurrence}
                    startDate={formData.start_time}
                    mappingsLoading={mappingsLoading}
                  />
                )}

                {/* Step 4: Review */}
                {activeStep === 3 && (
                  <ReviewStep
                    formData={formData}
                    meetingParticipants={meetingParticipants}
                    chairpersonName={chairpersonName}
                    gpsEnabled={gpsEnabled}
                    isRecurring={isRecurring}
                    recurrence={recurrence}
                    visibility={visibility}
                    restrictedDepartmentId={restrictedDepartmentId}
                    restrictedDepartmentName={restrictedDepartmentName}
                    organizationId={organizationId}
                    isEditMode={isEditMode}
                    apiLoading={apiLoading}
                    handleSubmit={handleSubmit}
                  />
                )}

                {/* Navigation Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                  <Button
                    onClick={handleBack}
                    disabled={apiLoading}
                    variant="outlined"
                  >
                    {activeStep === 0 ? 'Cancel' : 'Back'}
                  </Button>

                  {activeStep < 3 && (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      disabled={apiLoading || (activeStep === 0 && !isValid)}
                      sx={{
                        bgcolor: '#7C3AED',
                        '&:hover': { bgcolor: '#6D28D9' },
                        '&.Mui-disabled': { bgcolor: '#C4B5FD' }
                      }}
                    >
                      Next
                    </Button>
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Summary sidebar — fills remaining width, stays visible while scrolling */}
            {isDesktop && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper sx={{ p: 2.5, borderRadius: 3, position: 'sticky', top: 24 }}>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Meeting Summary
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Title</Typography>
                      <Typography variant="body2" fontWeight={500}>{formData?.title || 'Not set'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Date & Time</Typography>
                      <Typography variant="body2">
                        {formData?.meeting_date ? new Date(formData.meeting_date).toLocaleDateString() : 'Not set'}
                        {formData?.start_time && ` · ${new Date(formData.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Visibility</Typography>
                      <Typography variant="body2">
                        {visibility === 'restricted' ? (restrictedDepartmentName || 'Restricted') : 'Open to All'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Location</Typography>
                      <Typography variant="body2">{formData?.location_text || 'Not set'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Participants</Typography>
                      <Typography variant="body2">{meetingParticipants?.length || 0} added</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Chairperson</Typography>
                      <Typography variant="body2">{chairpersonName || 'Not selected'}</Typography>
                    </Box>
                    {isRecurring && recurrence && (
                      <Chip
                        icon={<RepeatIcon />}
                        label={`Recurring · ${recurrence.type}`}
                        color="primary"
                        size="small"
                        sx={{ alignSelf: 'flex-start' }}
                      />
                    )}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {STEPS.map((step, idx) => (
                      <Box
                        key={idx}
                        sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: idx <= activeStep ? 'primary.main' : 'divider' }}
                      />
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Step {activeStep + 1} of {STEPS.length}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>

        {/* Snackbar Notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        >
          <Alert
            severity={snackbar.severity}
            variant="filled"
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default React.memo(MeetingForm);