// src/components/meetings/MeetingForm/MeetingForm.jsx

import React from 'react';
import { 
  Box, Paper, Stepper, Step, StepLabel, Typography, 
  AppBar, Toolbar, IconButton, Button, CircularProgress,
  useMediaQuery, Alert, Snackbar, Stack, alpha,
  StepConnector, LinearProgress, Fade
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  ArrowBack as ArrowBackIcon, 
  Close as CloseIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { useMeetingForm } from './useMeetingForm';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { AccessControlStep } from './steps/AccessControlStep';
import { LocationGpsStep } from './steps/LocationGpsStep';
import { AgendaStep } from './steps/AgendaStep';
import { ParticipantsStep } from './steps/ParticipantsStep';
import { RecurrenceStep } from './steps/RecurrenceStep';
import { ReviewStep } from './steps/ReviewStep';
import { LoadingOverlay } from './components/LoadingOverlay';

const STEPS = [
  { id: 'basic', label: 'Basic Info', description: 'Title, date & time' },
  { id: 'access', label: 'Access Control', description: 'Visibility & departments' },
  { id: 'location', label: 'Location', description: 'Where & GPS' },
  { id: 'agenda', label: 'Agenda', description: 'Meeting agenda' },
  { id: 'participants', label: 'Participants', description: 'Add attendees' },
  { id: 'recurrence', label: 'Recurrence', description: 'Set schedule' },
  { id: 'review', label: 'Review', description: 'Confirm details' },
];

const STEP_COMPONENTS = {
  basic: BasicInfoStep,
  access: AccessControlStep,
  location: LocationGpsStep,
  agenda: AgendaStep,
  participants: ParticipantsStep,
  recurrence: RecurrenceStep,
  review: ReviewStep,
};

const MeetingForm = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isLight = theme.palette.mode === 'light';
  
  const {
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
    pageTitle,
    pageSubtitle,
    isRecurring,
    isValid,
    apiLoading,
    isEditMode,
    mappingsLoading,
    setFormData,
    setSnackbar,
    setRecurrence,
    setVisibility,
    setRestrictedDepartmentId,
    setRestrictedDepartmentName,
    setOrganizationId,
    setGpsEnabled,
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
    selectedUserIds,
    selectedParticipantIds,
  } = useMeetingForm();

  const progress = ((activeStep + 1) / STEPS.length) * 100;
  const CurrentStepComponent = STEP_COMPONENTS[STEPS[activeStep].id];

  const isStepComplete = React.useMemo(() => {
    switch(STEPS[activeStep].id) {
      case 'basic':
        return formData?.title?.trim() && formData?.meeting_date && formData?.start_time;
      case 'access':
        return true;
      case 'location':
        return true;
      case 'agenda':
        return true;
      case 'participants':
        return meetingParticipants?.length > 0;
      case 'recurrence':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [activeStep, formData, meetingParticipants]);

  if (formLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  const totalSteps = STEPS.length;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <LoadingOverlay open={isSubmitting} message={submitMessage} />
      
      <Box sx={{ 
        minHeight: '100vh', 
        bgcolor: isLight ? '#f0f2f5' : '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}>
        {/* Mobile Header */}
        {isMobile && (
          <AppBar 
            position="sticky" 
            color="default" 
            elevation={0} 
            sx={{ 
              borderBottom: 1, 
              borderColor: isLight ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)',
              bgcolor: isLight ? 'rgba(255,255,255,0.95)' : '#1a1a2e',
              flexShrink: 0,
            }}
          >
            <Toolbar sx={{ px: 1.5 }}>
              <IconButton edge="start" onClick={handleCancel} size="small" sx={{ color: isLight ? '#1a1a2e' : '#ffffff' }}>
                <ArrowBackIcon />
              </IconButton>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ color: isLight ? '#1a1a2e' : '#ffffff' }}>
                  {pageTitle}
                </Typography>
                <Typography variant="caption" sx={{ color: isLight ? '#6b6b8a' : '#aaaaaa' }}>
                  {STEPS[activeStep].label} · Step {activeStep + 1} of {totalSteps}
                </Typography>
              </Box>
              <IconButton edge="end" onClick={handleCancel} size="small" sx={{ color: isLight ? '#1a1a2e' : '#ffffff' }}>
                <CloseIcon />
              </IconButton>
            </Toolbar>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                height: 2, 
                bgcolor: isLight ? '#e0e0e0' : 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: '#667eea',
                }
              }}
            />
          </AppBar>
        )}

        {/* Main container */}
        <Box sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          width: '100%', 
          px: { xs: 1, sm: 2, md: 3 }, 
          py: { xs: 1, sm: 2 },
        }}>
          {/* Desktop Header */}
          {!isMobile && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 2, 
              flexWrap: 'wrap', 
              gap: 1,
              flexShrink: 0,
            }}>
              <Box>
                <Typography 
                  variant="h4" 
                  fontWeight={800} 
                  sx={{ 
                    color: isLight ? '#1a1a2e' : '#ffffff',
                    letterSpacing: '-0.5px',
                  }}
                >
                  {pageTitle}
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: isLight ? '#6b6b8a' : '#aaaaaa',
                    mt: 0.5,
                  }}
                >
                  {pageSubtitle}
                </Typography>
              </Box>
              <Button 
                variant="outlined" 
                startIcon={<CloseIcon />} 
                onClick={handleCancel} 
                disabled={apiLoading} 
                size="small"
                sx={{
                  borderRadius: 2,
                  borderColor: isLight ? '#d0d5dd' : 'rgba(255,255,255,0.2)',
                  color: isLight ? '#4a4a6a' : '#ffffff',
                  '&:hover': {
                    borderColor: '#667eea',
                    bgcolor: isLight ? 'rgba(102, 126, 234, 0.06)' : 'rgba(102, 126, 234, 0.15)',
                  }
                }}
              >
                Cancel
              </Button>
            </Box>
          )}

          {/* Main Form */}
          <Paper sx={{ 
            p: { xs: 1.5, sm: 2, md: 2.5 }, 
            borderRadius: 3,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            bgcolor: isLight ? '#ffffff' : '#1a1a2e',
            boxShadow: isLight
              ? '0 4px 24px rgba(0, 0, 0, 0.06)'
              : '0 4px 24px rgba(0, 0, 0, 0.4)',
            border: isLight ? 'none' : '1px solid rgba(255,255,255,0.05)',
          }}>
            {/* Stepper */}
            {!isMobile && (
              <Stepper 
                activeStep={activeStep} 
                sx={{ 
                  mb: 2, 
                  overflowX: 'auto',
                  flexShrink: 0,
                  '& .MuiStepLabel-label': {
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: isLight ? '#6b6b8a' : '#aaaaaa',
                  },
                  '& .MuiStepLabel-label.Mui-active': {
                    color: isLight ? '#1a1a2e' : '#ffffff',
                  },
                  '& .MuiStepIcon-root': {
                    fontSize: '1.2rem',
                    color: isLight ? '#d0d5dd' : '#3a3a5a',
                  },
                  '& .MuiStepIcon-root.Mui-active': {
                    color: '#667eea',
                  },
                  '& .MuiStepIcon-root.Mui-completed': {
                    color: '#4caf50',
                  },
                  '& .MuiStepIcon-text': {
                    fill: isLight ? '#1a1a2e' : '#ffffff',
                  },
                }}
                connector={
                  <StepConnector
                    sx={{
                      '& .MuiStepConnector-line': {
                        borderColor: isLight ? '#e8ecf1' : 'rgba(255,255,255,0.1)',
                        borderWidth: 1.5,
                      },
                      '& .MuiStepConnector-line.Mui-active': {
                        borderColor: '#667eea',
                      },
                      '& .MuiStepConnector-line.Mui-completed': {
                        borderColor: '#4caf50',
                      },
                    }}
                  />
                }
              >
                {STEPS.map((step, index) => (
                  <Step key={index} sx={{ minWidth: 40 }}>
                    <StepLabel>
                      <Typography 
                        variant="caption" 
                        fontWeight={index === activeStep ? 700 : 500}
                        sx={{
                          color: index === activeStep 
                            ? (isLight ? '#1a1a2e' : '#ffffff')
                            : (isLight ? '#6b6b8a' : '#888888'),
                          transition: 'color 0.2s ease',
                        }}
                      >
                        {step.label}
                      </Typography>
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            )}

            {/* Mobile Step Indicator */}
            {isMobile && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 1.5, 
                flexShrink: 0,
                px: 0.5,
              }}>
                <Typography variant="caption" fontWeight={600} sx={{ color: '#667eea' }}>
                  {STEPS[activeStep].label}
                </Typography>
                <Typography variant="caption" sx={{ color: isLight ? '#6b6b8a' : '#888888' }}>
                  {activeStep + 1} of {totalSteps}
                </Typography>
              </Box>
            )}

            {/* Progress dots for mobile */}
            {isMobile && (
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexShrink: 0 }}>
                {STEPS.map((_, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      bgcolor: idx <= activeStep 
                        ? '#667eea' 
                        : (isLight ? '#e8ecf1' : 'rgba(255,255,255,0.1)'),
                      transition: 'background-color 0.3s ease',
                    }}
                  />
                ))}
              </Box>
            )}

            {/* Content Area */}
            <Box sx={{ 
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              px: { xs: 0.5, sm: 1 },
              '&::-webkit-scrollbar': {
                width: 4,
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: isLight ? '#d0d5dd' : 'rgba(255,255,255,0.2)',
                borderRadius: 2,
              },
            }}>
              <Fade in key={activeStep} timeout={300}>
                <Box sx={{ height: '100%', pb: 1 }}>
                  <CurrentStepComponent
                    formData={formData}
                    setFormData={setFormData}
                    organizationId={organizationId}
                    setOrganizationId={setOrganizationId}
                    visibility={visibility}
                    setVisibility={setVisibility}
                    restrictedDepartmentId={restrictedDepartmentId}
                    restrictedDepartmentName={restrictedDepartmentName}
                    handleRestrictedDepartmentChange={handleRestrictedDepartmentChange}
                    handleClearRestrictedDepartment={handleClearRestrictedDepartment}
                    gpsEnabled={gpsEnabled}
                    setGpsEnabled={setGpsEnabled}
                    meetingParticipants={meetingParticipants}
                    selectedUserIds={selectedUserIds}
                    selectedParticipantIds={selectedParticipantIds}
                    recurrence={recurrence}
                    setRecurrence={setRecurrence}
                    chairpersonName={chairpersonName}
                    handleChange={handleChange}
                    handleDateChange={handleDateChange}
                    handleStartTimeChange={handleStartTimeChange}
                    handleEndTimeChange={handleEndTimeChange}
                    handleAgendaChange={handleAgendaChange}
                    handleLocationSelect={handleLocationSelect}
                    handleAddExistingUser={handleAddExistingUser}
                    handleAddManualParticipant={handleAddManualParticipant}
                    handleAddFromList={handleAddFromList}
                    handleRemoveParticipant={handleRemoveParticipant}
                    handleSetChairperson={handleSetChairperson}
                    apiLoading={apiLoading}
                    isEditMode={isEditMode}
                    isMobile={isMobile}
                    mappingsLoading={mappingsLoading}
                  />
                </Box>
              </Fade>
            </Box>

            {/* Navigation */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mt: 2,
              pt: 2,
              borderTop: 2, 
              borderColor: isLight ? '#e8ecf1' : 'rgba(255,255,255,0.08)',
              gap: 2,
              flexShrink: 0,
              bgcolor: isLight ? '#ffffff' : '#1a1a2e',
              borderRadius: '0 0 12px 12px',
              px: 0.5,
            }}>
              <Button 
                onClick={handleBack} 
                disabled={apiLoading || activeStep === 0}
                variant="outlined"
                size={isMobile ? 'medium' : 'large'}
                startIcon={<NavigateBeforeIcon />}
                sx={{ 
                  minWidth: 100,
                  visibility: activeStep === 0 ? 'hidden' : 'visible',
                  borderRadius: 2,
                  borderColor: isLight ? '#d0d5dd' : 'rgba(255,255,255,0.2)',
                  borderWidth: 2,
                  color: isLight ? '#4a4a6a' : '#ffffff',
                  fontWeight: 600,
                  px: 3,
                  py: 1,
                  '&:hover': {
                    borderColor: '#667eea',
                    bgcolor: isLight ? 'rgba(102, 126, 234, 0.08)' : 'rgba(102, 126, 234, 0.15)',
                  }
                }}
              >
                Back
              </Button>
              
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {!isMobile && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: isLight ? '#6b6b8a' : '#888888',
                      px: 1,
                      fontWeight: 500,
                    }}
                  >
                    {activeStep + 1} / {totalSteps}
                  </Typography>
                )}
                
                {activeStep < totalSteps - 1 ? (
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={apiLoading || !isStepComplete}
                    size={isMobile ? 'medium' : 'large'}
                    endIcon={<NavigateNextIcon />}
                    sx={{ 
                      borderRadius: 2,
                      minWidth: 120,
                      bgcolor: '#667eea',
                      color: '#ffffff',
                      fontWeight: 700,
                      px: 4,
                      py: 1.2,
                      boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
                      '&:hover': {
                        bgcolor: '#5a67d8',
                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
                        transform: 'translateY(-2px)',
                      },
                      '&:active': {
                        transform: 'translateY(0)',
                      },
                      '& .MuiButton-endIcon': {
                        transition: 'transform 0.2s ease',
                      },
                      '&:hover .MuiButton-endIcon': {
                        transform: 'translateX(4px)',
                      },
                      '&.Mui-disabled': { 
                        bgcolor: isLight ? '#c3cfe2' : 'rgba(102, 126, 234, 0.3)',
                        color: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
                        boxShadow: 'none',
                      },
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={apiLoading || isSubmitting}
                    size={isMobile ? 'medium' : 'large'}
                    startIcon={<CheckCircleIcon />}
                    sx={{ 
                      borderRadius: 2,
                      minWidth: 140,
                      bgcolor: '#10B981',
                      color: '#ffffff',
                      fontWeight: 700,
                      px: 4,
                      py: 1.2,
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                      '&:hover': {
                        bgcolor: '#059669',
                        boxShadow: '0 6px 20px rgba(16, 185, 129, 0.5)',
                        transform: 'translateY(-2px)',
                      },
                      '&:active': {
                        transform: 'translateY(0)',
                      },
                      '&.Mui-disabled': { 
                        bgcolor: isLight ? '#a7f3d0' : 'rgba(16, 185, 129, 0.3)',
                        color: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
                        boxShadow: 'none',
                      },
                    }}
                  >
                    {isSubmitting ? 'Saving...' : (isEditMode ? 'Update' : 'Create')}
                  </Button>
                )}
              </Box>
            </Box>

            {/* Validation message */}
            {!isStepComplete && activeStep < totalSteps - 1 && (
              <Fade in timeout={400}>
                <Alert 
                  severity="info" 
                  variant="outlined" 
                  sx={{ 
                    mt: 1.5, 
                    py: 0.5, 
                    flexShrink: 0,
                    borderRadius: 2,
                    bgcolor: isLight ? 'rgba(102, 126, 234, 0.04)' : 'rgba(102, 126, 234, 0.1)',
                    borderColor: isLight ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.3)',
                    '& .MuiAlert-icon': {
                      color: '#667eea',
                    },
                    '& .MuiAlert-message': {
                      color: isLight ? '#4a4a6a' : '#cccccc',
                    },
                  }}
                  icon={<InfoIcon sx={{ fontSize: 16 }} />}
                >
                  <Typography variant="caption">
                    Please complete all required fields before proceeding.
                  </Typography>
                </Alert>
              </Fade>
            )}
          </Paper>
        </Box>

        {/* Snackbar */}
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
            sx={{ 
              width: '100%',
              borderRadius: 2,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default React.memo(MeetingForm);