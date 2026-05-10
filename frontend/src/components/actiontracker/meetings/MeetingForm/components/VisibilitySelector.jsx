// src/components/meetings/MeetingForm/components/VisibilitySelector.jsx
import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Stack, Typography, Box, FormHelperText } from '@mui/material';
import { VISIBILITY_OPTIONS } from '../constants';

export const VisibilitySelector = ({ value, onChange, disabled }) => {
  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel>Meeting Visibility</InputLabel>
      <Select
        value={value || 'open'}
        onChange={(e) => onChange(e.target.value)}
        label="Meeting Visibility"
      >
        {VISIBILITY_OPTIONS.map(option => (
          <MenuItem key={option.value} value={option.value}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {option.icon}
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {option.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.description}
                </Typography>
              </Box>
            </Stack>
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>
        {value === 'open' 
          ? "Anyone can view and join this meeting" 
          : "Only members of the selected department can access this meeting"}
      </FormHelperText>
    </FormControl>
  );
};