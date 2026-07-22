// src/components/meetings/MeetingForm/steps/AccessControlStep.jsx
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Chip,
  Collapse,
  Tooltip,
  IconButton,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Lock as LockIcon,
  Info as InfoIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { VisibilitySelector } from '../components/VisibilitySelector';
import { DepartmentSelector } from '../components/DepartmentSelector';

// ============================================================================
// Constants
// ============================================================================

export const VISIBILITY = {
  DEPARTMENT: 'department',
  OPEN: 'open',
};

// Set "Department Only" as the default visibility mode
export const DEFAULT_VISIBILITY = VISIBILITY.DEPARTMENT;

// ============================================================================
// Sub-Components
// ============================================================================

const SectionPaper = ({ children, sx, ...props }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Paper
      elevation={0}
      {...props}
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
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const AccessControlStep = ({
  visibility,
  setVisibility,
  restrictedDepartmentId,
  setRestrictedDepartmentId,
  setRestrictedDepartmentName,
  handleRestrictedDepartmentChange,
  handleClearRestrictedDepartment: onClearDepartment,
  apiLoading = false,
  isSubmitting = false,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const isRestricted = visibility === VISIBILITY.DEPARTMENT;
  const disabled = apiLoading || isSubmitting;

  const setVisibilityRef = useRef(setVisibility);
  const setDepartmentRef = useRef(setRestrictedDepartmentId);
  const setDepartmentNameRef = useRef(setRestrictedDepartmentName);
  const departmentHandlerRef = useRef(handleRestrictedDepartmentChange);
  const clearHandlerRef = useRef(onClearDepartment);

  useEffect(() => {
    setVisibilityRef.current = setVisibility;
    setDepartmentRef.current = setRestrictedDepartmentId;
    setDepartmentNameRef.current = setRestrictedDepartmentName;
    departmentHandlerRef.current = handleRestrictedDepartmentChange;
    clearHandlerRef.current = onClearDepartment;
  });

  const commitDepartment = useCallback((id, dept) => {
    const setter = setDepartmentRef.current;
    const handler = departmentHandlerRef.current;

    if (typeof setter === 'function') {
      setter(id);
    } else if (typeof handler === 'function') {
      handler(id, dept);
    } else {
      console.error(
        'AccessControlStep: neither setRestrictedDepartmentId nor ' +
        'handleRestrictedDepartmentChange was passed.'
      );
      return;
    }

    if (typeof setDepartmentNameRef.current === 'function') {
      setDepartmentNameRef.current(dept?.name ?? null);
    }
  }, []);

  const handleVisibilityChange = useCallback((next) => {
    setVisibilityRef.current?.(next);
    if (next !== VISIBILITY.DEPARTMENT) {
      commitDepartment(null, null);
    }
  }, [commitDepartment]);

  const handleDepartmentChange = useCallback((next, dept) => {
    const id =
      next === null || next === undefined || next === '' ? null : String(next);
    commitDepartment(id, dept ?? null);
  }, [commitDepartment]);

  const handleClearRestrictedDepartment = useCallback(() => {
    if (typeof clearHandlerRef.current === 'function') {
      clearHandlerRef.current();
      return;
    }
    handleVisibilityChange(VISIBILITY.OPEN);
  }, [handleVisibilityChange]);

  // Ensure default fallback triggers if empty
  useEffect(() => {
    if (visibility === undefined || visibility === null || visibility === '') {
      setVisibilityRef.current?.(DEFAULT_VISIBILITY);
    }
  }, [visibility]);

  const departmentValue =
    restrictedDepartmentId === undefined || restrictedDepartmentId === null
      ? ''
      : String(restrictedDepartmentId);

  return (
    <Box sx={{ width: '100%' }}>
      <Stack spacing={2.5}>
        <SectionPaper
          sx={{
            bgcolor: isRestricted
              ? (isLight
                ? alpha(theme.palette.warning.main, 0.04)
                : alpha(theme.palette.warning.main, 0.08))
              : undefined,
            borderColor: isRestricted
              ? (isLight
                ? alpha(theme.palette.warning.main, 0.2)
                : alpha(theme.palette.warning.main, 0.3))
              : undefined,
          }}
        >
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <BusinessIcon
                  sx={{
                    fontSize: 18,
                    color: isRestricted
                      ? 'warning.main'
                      : (isLight ? '#6b6b8a' : '#888888'),
                  }}
                />
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{
                    color: isRestricted
                      ? (isLight ? 'warning.dark' : 'warning.light')
                      : (isLight ? '#1a1a2e' : '#ffffff'),
                  }}
                >
                  Department Access Control
                </Typography>
                <Tooltip
                  title="Restrict this meeting to specific department members"
                  arrow
                >
                  <IconButton size="small" sx={{ p: 0 }}>
                    <HelpIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  </IconButton>
                </Tooltip>
              </Box>

              {isRestricted && (
                <Chip
                  label="Restricted"
                  size="small"
                  color="warning"
                  icon={<LockIcon sx={{ fontSize: 12 }} />}
                  onDelete={disabled ? undefined : handleClearRestrictedDepartment}
                  sx={{ height: 22 }}
                />
              )}
            </Box>

            <VisibilitySelector
              value={visibility ?? DEFAULT_VISIBILITY}
              onChange={handleVisibilityChange}
              disabled={disabled}
              isLight={isLight}
            />

            <Collapse in={isRestricted} timeout={300} unmountOnExit={false}>
              <Box>
                <DepartmentSelector
                  value={departmentValue}
                  onChange={handleDepartmentChange}
                  disabled={disabled || !isRestricted}
                  isLight={isLight}
                />
              </Box>
            </Collapse>

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 1,
                p: 1.5,
                borderRadius: 1,
                bgcolor: isRestricted
                  ? (isLight
                    ? alpha(theme.palette.warning.main, 0.04)
                    : alpha(theme.palette.warning.main, 0.08))
                  : (isLight
                    ? alpha(theme.palette.info.main, 0.04)
                    : alpha(theme.palette.info.main, 0.08)),
                border: '1px solid',
                borderColor: isRestricted
                  ? (isLight
                    ? alpha(theme.palette.warning.main, 0.1)
                    : alpha(theme.palette.warning.main, 0.15))
                  : (isLight
                    ? alpha(theme.palette.info.main, 0.1)
                    : alpha(theme.palette.info.main, 0.15)),
              }}
            >
              <InfoIcon
                sx={{
                  fontSize: 16,
                  color: isRestricted ? 'warning.main' : 'info.main',
                  mt: 0.25,
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: isLight ? '#4a4a6a' : '#aaaaaa' }}
              >
                {isRestricted
                  ? '🔒 This meeting will be visible only to members of the selected department.'
                  : '🌐 This meeting will be open to all departments. Select "Restricted to Department" to limit access.'}
              </Typography>
            </Box>
          </Stack>
        </SectionPaper>
      </Stack>
    </Box>
  );
};

export default AccessControlStep;