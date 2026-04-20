// src/components/actiontracker/meetings/ParticipantSelector.jsx
import React, { useState, useEffect } from 'react';
import {
  Autocomplete, TextField, Chip, Avatar, Stack, Typography,
  Checkbox, Box, CircularProgress
} from '@mui/material';
import { PersonAdd as PersonIcon } from '@mui/icons-material';
import api from '../../../services/api';

const ParticipantSelector = ({ value = [], onChange, meetingId, disabled }) => {
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
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            label={option.full_name || option.username}
            avatar={<Avatar>{option.full_name?.[0] || option.username?.[0]}</Avatar>}
            {...getTagProps({ index })}
          />
        ))
      }
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox checked={selected} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar sx={{ width: 32, height: 32 }}>
              {option.full_name?.[0] || option.username?.[0]}
            </Avatar>
            <Box>
              <Typography variant="body2">
                {option.full_name || option.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
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
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default ParticipantSelector;