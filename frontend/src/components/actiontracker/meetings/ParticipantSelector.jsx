// src/components/actiontracker/meetings/ParticipantSelector.jsx
import React, { useState, useEffect } from 'react';
import {
  Autocomplete, TextField, Chip, Avatar, Stack, Typography,
  Checkbox, Box, CircularProgress, useTheme, alpha
} from '@mui/material';
import { PersonAdd as PersonIcon } from '@mui/icons-material';
import api from '../../../services/api';

const ParticipantSelector = ({ value = [], onChange, meetingId, disabled }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users', { params: { limit: 100 } });
      setUsers(response.data?.items || response.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event, newValue) => {
    onChange(newValue);
  };

  return (
    <Autocomplete
      multiple
      options={users}
      value={value}
      onChange={handleChange}
      getOptionLabel={(option) => option.full_name || option.username || option.email}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      loading={loading}
      disabled={disabled}
      filterOptions={(options, state) => {
        const searchLower = state.inputValue.toLowerCase();
        return options.filter(opt => 
          opt.full_name?.toLowerCase().includes(searchLower) ||
          opt.username?.toLowerCase().includes(searchLower) ||
          opt.email?.toLowerCase().includes(searchLower)
        );
      }}
      sx={{
        '& .MuiAutocomplete-tag': {
          bgcolor: isDark ? alpha(theme.palette.primary.main, 0.1) : 'action.hover',
          borderRadius: 2,
          '& .MuiChip-deleteIcon': {
            color: 'text.secondary',
            '&:hover': {
              color: 'error.main'
            }
          }
        }
      }}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            label={option.full_name || option.username}
            avatar={
              <Avatar sx={{ 
                bgcolor: isDark ? alpha(theme.palette.primary.main, 0.2) : 'primary.main',
                color: '#fff'
              }}>
                {option.full_name?.[0] || option.username?.[0]}
              </Avatar>
            }
            {...getTagProps({ index })}
            sx={{
              '&:hover': {
                bgcolor: isDark ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.primary.main, 0.1),
              }
            }}
          />
        ))
      }
      renderOption={(props, option, { selected }) => (
        <li {...props} style={{ ...props.style, backgroundColor: 'transparent' }}>
          <Checkbox 
            checked={selected} 
            sx={{
              color: 'text.secondary',
              '&.Mui-checked': {
                color: 'primary.main',
              }
            }}
          />
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ 
              width: 36, 
              height: 36,
              bgcolor: selected 
                ? alpha(theme.palette.primary.main, 0.2)
                : isDark 
                  ? alpha(theme.palette.action.hover, 0.5)
                  : 'action.hover',
              color: selected ? 'primary.main' : 'text.primary'
            }}>
              {option.full_name?.[0] || option.username?.[0]}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={selected ? 600 : 400} sx={{ color: 'text.primary' }}>
                {option.full_name || option.username}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {option.email}
              </Typography>
            </Box>
          </Stack>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Select Participants"
          placeholder="Search by name or email..."
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={20} sx={{ color: 'primary.main' }} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'background.paper',
              '& fieldset': {
                borderColor: theme.palette.divider,
              },
              '&:hover fieldset': {
                borderColor: theme.palette.primary.main,
              },
              '&.Mui-focused fieldset': {
                borderColor: theme.palette.primary.main,
              }
            },
            '& .MuiInputLabel-root': {
              color: 'text.secondary',
              '&.Mui-focused': {
                color: 'primary.main',
              }
            }
          }}
        />
      )}
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            mt: 0.5,
            '& .MuiAutocomplete-listbox': {
              bgcolor: 'background.paper',
              '& .MuiAutocomplete-option': {
                color: 'text.primary',
                '&[aria-selected="true"]': {
                  bgcolor: isDark ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.05),
                },
                '&.Mui-focused': {
                  bgcolor: isDark ? alpha(theme.palette.action.hover, 0.2) : 'action.hover',
                },
                '&:hover': {
                  bgcolor: isDark ? alpha(theme.palette.action.hover, 0.15) : 'action.hover',
                }
              }
            }
          }
        },
        popper: {
          sx: {
            '& .MuiAutocomplete-paper': {
              boxShadow: theme.shadows[isDark ? 8 : 4],
            }
          }
        }
      }}
    />
  );
};

export default ParticipantSelector;