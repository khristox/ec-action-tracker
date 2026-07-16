// src/components/meetings/MeetingForm/steps/AccessControlStep.jsx
import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Chip,
  Fade,
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
// Sub-Components
// (mirrors the SectionPaper pattern used in BasicInfoStep.jsx)
// ============================================================================

const SectionPaper = ({ children, ...props }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
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
        ...props.sx,
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
  apiLoading = false,
  isSubmitting = false,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const isRestricted = useMemo(() => visibility === 'department', [visibility]);

  const handleClearRestrictedDepartment = () => {
    setRestrictedDepartmentId?.(null);
    setVisibility?.('all');
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stack spacing={2.5}>
        <SectionPaper
          sx={{
            bgcolor: isRestricted
              ? (isLight ? alpha(theme.palette.warning.main, 0.04) : alpha(theme.palette.warning.main, 0.08))
              : undefined,
            borderColor: isRestricted
              ? (isLight ? alpha(theme.palette.warning.main, 0.2) : alpha(theme.palette.warning.main, 0.3))
              : undefined,
          }}
        >
          <Stack spacing={2}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
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
                <Tooltip title="Restrict this meeting to specific department members" arrow>
                  <IconButton size="small" sx={{ p: 0 }}>
                    <HelpIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  </IconButton>
                </Tooltip>
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
              disabled={apiLoading || isSubmitting}
              isLight={isLight}
            />

            {isRestricted && (
              <Fade in timeout={300}>
                <Box>
                  <DepartmentSelector
                    value={restrictedDepartmentId}
                    onChange={setRestrictedDepartmentId}
                    disabled={apiLoading || isSubmitting}
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
                p: 1.5,
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
                  : '🌐 This meeting will be open to all departments. Select "Restricted to Department" to limit access.'
                }
              </Typography>
            </Stack>
          </Stack>
        </SectionPaper>
      </Stack>
    </Box>
  );
};

export default AccessControlStep;