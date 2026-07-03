// src/components/meetings/MeetingForm/steps/AccessControlStep.jsx
import React from 'react';
import { Stack, Box, Typography, Alert, Collapse, Tooltip, alpha } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Lock as LockIcon, Help as HelpIcon } from '@mui/icons-material';
import { VisibilitySelector } from '../components/VisibilitySelector';
import { DepartmentSelector } from '../components/DepartmentSelector';

export const AccessControlStep = ({
  visibility,
  setVisibility,
  restrictedDepartmentId,
  setRestrictedDepartmentId,
  apiLoading,
}) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Stack spacing={2.5} sx={{ textAlign: 'left', alignItems: 'stretch' }}>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 2.5,
          bgcolor: isLight ? alpha(theme.palette.primary.main, 0.025) : 'transparent',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <LockIcon sx={{ fontSize: 18 }} color="action" />
          <Typography variant="body2" fontWeight={600}>
            Department Access Control
          </Typography>
          <Tooltip title="Restrict this meeting to specific department members">
            <HelpIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'help' }} />
          </Tooltip>
        </Stack>

        <VisibilitySelector value={visibility} onChange={setVisibility} disabled={apiLoading} />

        <Collapse in={visibility === 'department'}>
          <Box sx={{ mt: 2 }}>
            <DepartmentSelector
              value={restrictedDepartmentId}
              onChange={setRestrictedDepartmentId}
              disabled={apiLoading}
            />
          </Box>
        </Collapse>

        {visibility !== 'department' && (
          <Alert severity="info" sx={{ mt: 2 }} variant="outlined">
            <Typography variant="caption">
              This meeting will be open to all departments. Select "Department Only" to limit
              access to specific department members.
            </Typography>
          </Alert>
        )}
      </Box>
    </Stack>
  );
};

export default AccessControlStep;