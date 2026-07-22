// src/components/meetings/MeetingForm/components/VisibilitySelector.jsx
import React, { useMemo } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  FormHelperText,
} from '@mui/material';
import { VISIBILITY_OPTIONS, DEFAULT_VISIBILITY } from '../constants';

// Small colour dot built from option.color, which VISIBILITY_OPTIONS actually
// has. (The previous version rendered option.icon, which does not exist on
// these objects, so it silently rendered nothing.)
const Dot = ({ color }) => (
  <Box
    component="span"
    sx={{
      width: 10,
      height: 10,
      borderRadius: '50%',
      flexShrink: 0,
      bgcolor: color || 'text.disabled',
    }}
  />
);

export const VisibilitySelector = ({
  value,
  onChange,
  disabled,
  defaultValue = DEFAULT_VISIBILITY,
}) => {
  const optionValues = useMemo(
    () => VISIBILITY_OPTIONS.map((o) => o.value),
    []
  );

  // Guard against an out-of-range value. On first mount `value` is often
  // undefined; without this the Select renders blank and MUI logs the
  // controlled/uncontrolled warning.
  const safeValue = useMemo(() => {
    if (value && optionValues.includes(value)) return value;
    if (optionValues.includes(defaultValue)) return defaultValue;
    return optionValues[0] ?? '';
  }, [value, defaultValue, optionValues]);

  const selectedOption = useMemo(
    () => VISIBILITY_OPTIONS.find((o) => o.value === safeValue),
    [safeValue]
  );

  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel id="meeting-visibility-label">Meeting Visibility</InputLabel>
      <Select
        labelId="meeting-visibility-label"
        id="meeting-visibility"
        value={safeValue}
        onChange={(e) => onChange?.(e.target.value)}
        label="Meeting Visibility"
        renderValue={(selected) => {
          const option = VISIBILITY_OPTIONS.find((o) => o.value === selected);
          if (!option) return null;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Dot color={option.color} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} noWrap>
                  {option.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {option.description}
                </Typography>
              </Box>
            </Box>
          );
        }}
      >
        {VISIBILITY_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {/* Box + sx, never Stack. In this project Stack forwards
                alignItems / justifyContent / flexWrap straight to the DOM. */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Dot color={option.color} />
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {option.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.description}
                </Typography>
              </Box>
            </Box>
          </MenuItem>
        ))}
      </Select>

      <FormHelperText>{selectedOption?.description ?? ''}</FormHelperText>
    </FormControl>
  );
};

export default VisibilitySelector;