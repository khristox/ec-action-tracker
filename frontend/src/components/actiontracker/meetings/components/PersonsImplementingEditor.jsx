// src/components/actiontracker/meetings/components/PersonsImplementingEditor.jsx

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  TextField,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardContent,
  useMediaQuery,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import AssignToSelector from './AssignToSelector';
// ✅ These functions are now exported from personsImplementing.js
import { 
  createEmptyPerson, 
  updatePerson, 
  removePerson, 
  handlePersonPicked 
} from './personsImplementing';

const PersonsImplementingEditor = ({
  value = [],
  onChange,
  disabled = false,
  meetingId = null,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';

  const colors = {
    surface: isDarkMode ? '#1E1E1E' : '#FFFFFF',
    surfaceAlt: isDarkMode ? '#2D2D2D' : '#F8F9FA',
    border: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
    textPrimary: isDarkMode ? '#FFFFFF' : '#1A1A2E',
    textSecondary: isDarkMode ? '#A0A0B0' : '#6B7280',
    primary: isDarkMode ? '#818CF8' : '#6366F1',
  };

  const handleAddPerson = () => {
    const newPerson = createEmptyPerson();
    onChange([...value, newPerson]);
  };

  const handleRemove = (rowId) => {
    onChange(removePerson(value, rowId));
  };

  const handleUpdate = (rowId, patch) => {
    onChange(updatePerson(value, rowId, patch));
  };

  const handlePersonSelect = (rowId, picked) => {
    onChange(handlePersonPicked(value, rowId, picked));
  };

  // Show empty state
  if (value.length === 0) {
    return (
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          <GroupsIcon fontSize="small" sx={{ color: colors.primary }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: colors.textPrimary }}>
            Person(s) Implementing
          </Typography>
        </Stack>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: `1px dashed ${colors.border}`,
            bgcolor: colors.surfaceAlt,
            textAlign: 'center',
            mb: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ color: colors.textSecondary }}>
            No implementers added yet. Click "Add Implementer" to assign.
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddPerson}
          disabled={disabled}
          sx={{
            color: colors.primary,
            '&:hover': { bgcolor: isDarkMode ? alpha(colors.primary, 0.08) : alpha(colors.primary, 0.08) },
          }}
        >
          Add Implementer
        </Button>
      </Box>
    );
  }

  // Desktop table view
  if (!isMobile) {
    return (
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          <GroupsIcon fontSize="small" sx={{ color: colors.primary }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: colors.textPrimary }}>
            Person(s) Implementing
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" sx={{ color: colors.textSecondary }}>
            {value.length} implementer{value.length !== 1 ? 's' : ''}
          </Typography>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            mb: 2,
            borderColor: colors.border,
            bgcolor: colors.surfaceAlt,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: isDarkMode ? alpha(colors.primary, 0.05) : alpha(colors.primary, 0.04) }}>
                <TableCell sx={{ fontWeight: 600, color: colors.textSecondary }}>Person</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colors.textSecondary }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 600, color: colors.textSecondary }}>Email</TableCell>
                <TableCell width={48} />
              </TableRow>
            </TableHead>
            <TableBody>
              {value.map((row) => (
                <TableRow key={row.row_id} hover>
                  <TableCell sx={{ minWidth: 180 }}>
                    <AssignToSelector
                      value={row.assigned_to_id ? { 
                        type: 'user', 
                        id: row.assigned_to_id, 
                        name: row.name, 
                        email: row.email, 
                        phone: row.phone 
                      } : null}
                      onChange={(picked) => handlePersonSelect(row.row_id, picked)}
                      disabled={disabled}
                      label="Person"
                      meetingId={meetingId}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 140 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={row.phone}
                      onChange={(e) => handleUpdate(row.row_id, { phone: e.target.value })}
                      disabled={disabled}
                      placeholder="Phone No."
                      sx={{ '& .MuiInputBase-root': { bgcolor: isDarkMode ? '#1E1E1E' : '#FFFFFF' } }}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={row.email}
                      onChange={(e) => handleUpdate(row.row_id, { email: e.target.value })}
                      disabled={disabled}
                      placeholder="Email Address"
                      sx={{ '& .MuiInputBase-root': { bgcolor: isDarkMode ? '#1E1E1E' : '#FFFFFF' } }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleRemove(row.row_id)}
                      disabled={disabled}
                      sx={{
                        color: isDarkMode ? '#6B7280' : '#9CA3AF',
                        '&:hover': { color: '#EF4444' },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddPerson}
          disabled={disabled}
          sx={{
            color: colors.primary,
            '&:hover': { bgcolor: isDarkMode ? alpha(colors.primary, 0.08) : alpha(colors.primary, 0.08) },
          }}
        >
          Add Implementer
        </Button>
      </Box>
    );
  }

  // Mobile card view
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <GroupsIcon fontSize="small" sx={{ color: colors.primary }} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ color: colors.textPrimary }}>
          Person(s) Implementing
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: colors.textSecondary }}>
          {value.length} implementer{value.length !== 1 ? 's' : ''}
        </Typography>
      </Stack>

      <Stack spacing={1.5} sx={{ mb: 2 }}>
        {value.map((row, idx) => (
          <Card
            key={row.row_id}
            variant="outlined"
            sx={{
              borderColor: colors.border,
              bgcolor: colors.surfaceAlt,
              borderRadius: 2,
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PersonIcon fontSize="small" sx={{ color: colors.primary }} />
                  <Typography variant="caption" fontWeight={600} sx={{ color: colors.textSecondary }}>
                    Implementer {idx + 1}
                  </Typography>
                </Stack>
                <IconButton
                  size="small"
                  onClick={() => handleRemove(row.row_id)}
                  disabled={disabled}
                  sx={{ color: isDarkMode ? '#6B7280' : '#9CA3AF' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Stack spacing={2}>
                <AssignToSelector
                  value={row.assigned_to_id ? { 
                    type: 'user', 
                    id: row.assigned_to_id, 
                    name: row.name, 
                    email: row.email, 
                    phone: row.phone 
                  } : null}
                  onChange={(picked) => handlePersonSelect(row.row_id, picked)}
                  disabled={disabled}
                  label="Person"
                  meetingId={meetingId}
                />
                <TextField
                  size="small"
                  fullWidth
                  label="Phone No."
                  value={row.phone}
                  onChange={(e) => handleUpdate(row.row_id, { phone: e.target.value })}
                  disabled={disabled}
                  sx={{ '& .MuiInputBase-root': { bgcolor: isDarkMode ? '#1E1E1E' : '#FFFFFF' } }}
                />
                <TextField
                  size="small"
                  fullWidth
                  label="Email Address"
                  value={row.email}
                  onChange={(e) => handleUpdate(row.row_id, { email: e.target.value })}
                  disabled={disabled}
                  sx={{ '& .MuiInputBase-root': { bgcolor: isDarkMode ? '#1E1E1E' : '#FFFFFF' } }}
                />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={handleAddPerson}
        disabled={disabled}
        sx={{
          color: colors.primary,
          '&:hover': { bgcolor: isDarkMode ? alpha(colors.primary, 0.08) : alpha(colors.primary, 0.08) },
        }}
      >
        Add Implementer
      </Button>
    </Box>
  );
};

export default PersonsImplementingEditor;