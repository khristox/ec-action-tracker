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
  Tooltip,
  useMediaQuery,
  useTheme,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import AssignToSelector from './AssignToSelector';
import { 
  createEmptyPerson, 
  updatePerson, 
  removePerson, 
  handlePersonPicked,
  isPersonSourcePrivate,
  getPersonDisplayInfo,
} from './personsImplementing';

// Privacy constants
const PRIVATE_NAME_LABEL = 'Private (System User)';
const PRIVATE_FIELD_LABEL = '••••••••';

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
    borderDashed: isDarkMode ? 'rgba(255,255,255,0.12)' : '#D1D5DB',
    textPrimary: isDarkMode ? '#FFFFFF' : '#1A1A2E',
    textSecondary: isDarkMode ? '#A0A0B0' : '#6B7280',
    primary: isDarkMode ? '#818CF8' : '#6366F1',
    error: isDarkMode ? '#F87171' : '#EF4444',
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

  const getDisplayInfo = (row) => {
    return getPersonDisplayInfo(row);
  };

  const getSelectorValue = (row) => {
    if (!row.assigned_to_id && !row.name) return null;
    const displayInfo = getDisplayInfo(row);
    return {
      type: 'user',
      id: row.assigned_to_id,
      name: displayInfo.displayName,
      email: displayInfo.displayEmail,
      phone: displayInfo.displayPhone,
    };
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
          <Typography variant="caption" sx={{ color: colors.textSecondary, ml: 1 }}>
            (0)
          </Typography>
        </Stack>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: `1px dashed ${colors.borderDashed}`,
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
            textTransform: 'none',
            fontWeight: 600,
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
              {value.map((row) => {
                const isPrivate = isPersonSourcePrivate(row);
                const displayInfo = getDisplayInfo(row);
                
                return (
                  <TableRow key={row.row_id} hover>
                    <TableCell sx={{ minWidth: 180 }}>
                      <AssignToSelector
                        value={getSelectorValue(row)}
                        onChange={(picked) => handlePersonSelect(row.row_id, picked)}
                        disabled={disabled}
                        label="Person"
                        meetingId={meetingId}
                      />
                      {isPrivate && (
                        <Tooltip title="This person was assigned from the System Users list, so their identity is hidden from this record for privacy.">
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                            <LockIcon sx={{ fontSize: 12, color: colors.textSecondary }} />
                            <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.65rem' }}>
                              Identity private
                            </Typography>
                          </Stack>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      {isPrivate ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 1,
                              bgcolor: alpha(colors.border, 0.3),
                              fontFamily: 'monospace',
                              letterSpacing: '2px',
                              color: colors.textSecondary,
                            }}
                          >
                            {PRIVATE_FIELD_LABEL}
                          </Box>
                        </Stack>
                      ) : (
                        <TextField
                          size="small"
                          fullWidth
                          value={row.phone || ''}
                          onChange={(e) => handleUpdate(row.row_id, { phone: e.target.value })}
                          disabled={disabled}
                          placeholder="Phone No."
                          sx={{ 
                            '& .MuiInputBase-root': { 
                              bgcolor: isDarkMode ? '#1E1E1E' : '#FFFFFF' 
                            } 
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      {isPrivate ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 1,
                              bgcolor: alpha(colors.border, 0.3),
                              fontFamily: 'monospace',
                              letterSpacing: '2px',
                              color: colors.textSecondary,
                            }}
                          >
                            {PRIVATE_FIELD_LABEL}
                          </Box>
                        </Stack>
                      ) : (
                        <TextField
                          size="small"
                          fullWidth
                          value={row.email || ''}
                          onChange={(e) => handleUpdate(row.row_id, { email: e.target.value })}
                          disabled={disabled}
                          placeholder="Email Address"
                          sx={{ 
                            '& .MuiInputBase-root': { 
                              bgcolor: isDarkMode ? '#1E1E1E' : '#FFFFFF' 
                            } 
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleRemove(row.row_id)}
                        disabled={disabled}
                        sx={{
                          color: isDarkMode ? '#6B7280' : '#9CA3AF',
                          '&:hover': { color: colors.error },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
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
            textTransform: 'none',
            fontWeight: 600,
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
        {value.map((row, idx) => {
          const isPrivate = isPersonSourcePrivate(row);
          const displayInfo = getDisplayInfo(row);
          
          return (
            <Card
              key={row.row_id}
              variant="outlined"
              sx={{
                borderColor: colors.border,
                bgcolor: colors.surfaceAlt,
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: colors.primary,
                  boxShadow: isDarkMode 
                    ? `0 4px 12px rgba(0,0,0,0.3)` 
                    : `0 4px 12px rgba(99,102,241,0.1)`,
                },
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PersonIcon fontSize="small" sx={{ color: colors.primary }} />
                    <Typography variant="caption" fontWeight={600} sx={{ color: colors.textSecondary }}>
                      Implementer {idx + 1}
                    </Typography>
                    {isPrivate && (
                      <Tooltip title="This person was assigned from the System Users list, so their identity is hidden from this record for privacy.">
                        <Stack direction="row" spacing={0.3} alignItems="center">
                          <LockIcon sx={{ fontSize: 12, color: colors.textSecondary }} />
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.65rem' }}>
                            Private
                          </Typography>
                        </Stack>
                      </Tooltip>
                    )}
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(row.row_id)}
                    disabled={disabled}
                    sx={{ 
                      color: isDarkMode ? '#6B7280' : '#9CA3AF',
                      '&:hover': { color: colors.error },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
                
                <Stack spacing={2}>
                  <AssignToSelector
                    value={getSelectorValue(row)}
                    onChange={(picked) => handlePersonSelect(row.row_id, picked)}
                    disabled={disabled}
                    label="Person"
                    meetingId={meetingId}
                  />
                  
                  {isPrivate ? (
                    <>
                      <Stack 
                        direction="row" 
                        spacing={1.5} 
                        alignItems="center" 
                        sx={{ 
                          p: 1.5, 
                          bgcolor: alpha(colors.border, 0.2), 
                          borderRadius: 1.5,
                          border: `1px solid ${alpha(colors.border, 0.3)}`,
                        }}
                      >
                        <PhoneIcon sx={{ fontSize: 18, color: colors.textSecondary }} />
                        <Box>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.65rem' }}>
                            Phone
                          </Typography>
                          <Box
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 1,
                              bgcolor: alpha(colors.border, 0.3),
                              fontFamily: 'monospace',
                              letterSpacing: '2px',
                              color: colors.textSecondary,
                              display: 'inline-block',
                            }}
                          >
                            {PRIVATE_FIELD_LABEL}
                          </Box>
                        </Box>
                      </Stack>
                      <Stack 
                        direction="row" 
                        spacing={1.5} 
                        alignItems="center" 
                        sx={{ 
                          p: 1.5, 
                          bgcolor: alpha(colors.border, 0.2), 
                          borderRadius: 1.5,
                          border: `1px solid ${alpha(colors.border, 0.3)}`,
                        }}
                      >
                        <EmailIcon sx={{ fontSize: 18, color: colors.textSecondary }} />
                        <Box>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.65rem' }}>
                            Email
                          </Typography>
                          <Box
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 1,
                              bgcolor: alpha(colors.border, 0.3),
                              fontFamily: 'monospace',
                              letterSpacing: '2px',
                              color: colors.textSecondary,
                              display: 'inline-block',
                            }}
                          >
                            {PRIVATE_FIELD_LABEL}
                          </Box>
                        </Box>
                      </Stack>
                    </>
                  ) : (
                    <>
                      <TextField
                        size="small"
                        fullWidth
                        label="Phone No."
                        value={row.phone || ''}
                        onChange={(e) => handleUpdate(row.row_id, { phone: e.target.value })}
                        disabled={disabled}
                        sx={{ 
                          '& .MuiInputBase-root': { 
                            bgcolor: isDarkMode ? '#1E1E1E' : '#FFFFFF' 
                          } 
                        }}
                      />
                      <TextField
                        size="small"
                        fullWidth
                        label="Email Address"
                        value={row.email || ''}
                        onChange={(e) => handleUpdate(row.row_id, { email: e.target.value })}
                        disabled={disabled}
                        sx={{ 
                          '& .MuiInputBase-root': { 
                            bgcolor: isDarkMode ? '#1E1E1E' : '#FFFFFF' 
                          } 
                        }}
                      />
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={handleAddPerson}
        disabled={disabled}
        sx={{
          color: colors.primary,
          textTransform: 'none',
          fontWeight: 600,
          '&:hover': { bgcolor: isDarkMode ? alpha(colors.primary, 0.08) : alpha(colors.primary, 0.08) },
        }}
      >
        Add Implementer
      </Button>
    </Box>
  );
};

export default PersonsImplementingEditor;