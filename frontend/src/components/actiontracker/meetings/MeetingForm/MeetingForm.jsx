// src/components/meetings/MeetingForm/MeetingForm.jsx
import React from 'react';
import { 
  Box, Paper, Stepper, Step, StepLabel, Typography, Container, 
  AppBar, Toolbar, IconButton, Button, CircularProgress,
  useMediaQuery, Alert, Snackbar
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowBack as ArrowBackIcon, Close as CloseIcon } from '@mui/icons-material';
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
    restrictedDepartmentName, // Add this - now available from hook
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
    setRestrictedDepartmentName, // Add this
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
    handleRestrictedDepartmentChange, // Add this - new handler
    handleClearRestrictedDepartment, // Add this - new handler
  } = useMeetingForm();

  // Show loading state
  if (formLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
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
              <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>
                {pageTitle}
              </Typography>
              <IconButton edge="end" onClick={handleCancel} aria-label="close">
                <CloseIcon />
              </IconButton>
            </Toolbar>
          </AppBar>
        )}

        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, sm: 3 } }}>
          {/* Desktop Header */}
          {!isMobile && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="h4" fontWeight={800} color="primary">
                  {pageTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {pageSubtitle}
                </Typography>
              </Box>
              <Button 
                variant="outlined" 
                startIcon={<CloseIcon />} 
                onClick={handleCancel} 
                disabled={apiLoading}
              >
                Cancel
              </Button>
            </Box>
          )}

          {/* Main Form Paper */}
          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, borderRadius: { xs: 2, md: 3 } }}>
            {/* Desktop Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 4, display: isMobile ? 'none' : 'flex' }}>
              {STEPS.map((step, index) => (
                <Step key={index}>
                  <StepLabel>
                    <Typography variant="body2" fontWeight={600}>{step.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {step.description}
                    </Typography>
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
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
        </Container>

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