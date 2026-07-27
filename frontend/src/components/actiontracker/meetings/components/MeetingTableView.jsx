// src/components/actiontracker/meetings/components/MeetingTableView.jsx

import {
  Paper, Table, TableContainer, TableHead, TableBody, TableRow,
  TableCell, Stack, Typography, Chip, IconButton, useTheme, alpha
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Edit from '@mui/icons-material/Edit';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RepeatIcon from '@mui/icons-material/Repeat';
import { StatusChip } from './StatusChip';
import { formatDate, formatTime } from '../utils/helpers';

// ==================== DARK MODE COLORS ====================
const DARK_MODE = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceLighter: '#334155',
  text: '#E2E8F0',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.05)',
  primary: '#A78BFA',
  primaryDark: '#7C3AED',
  primaryHover: '#6D28D9',
  hover: 'rgba(255,255,255,0.04)',
};

export const MeetingTableView = ({ 
  meetings, 
  onView, 
  onEdit, 
  onNotify,
  isDarkMode: propIsDarkMode 
}) => {
  const theme = useTheme();
  const isDarkMode = propIsDarkMode ?? (theme.palette.mode === 'dark');
  const dm = isDarkMode ? DARK_MODE : {};

  // If no meetings, show empty state
  if (!meetings || meetings.length === 0) {
    return (
      <Paper 
        elevation={0} 
        sx={{ 
          borderRadius: 3, 
          overflow: 'hidden',
          bgcolor: isDarkMode ? DARK_MODE.surface : 'background.paper',
          border: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none',
          p: 4,
          textAlign: 'center'
        }}
      >
        <Typography 
          variant="body1" 
          color={isDarkMode ? DARK_MODE.textSecondary : 'text.secondary'}
        >
          No meetings to display
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        borderRadius: 3, 
        overflow: 'hidden',
        bgcolor: isDarkMode ? DARK_MODE.surface : 'background.paper',
        border: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none',
      }}
    >
      <TableContainer>
        <Table>
          <TableHead 
            sx={{ 
              bgcolor: isDarkMode ? DARK_MODE.surfaceLighter : 'grey.50',
              borderBottom: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none',
            }}
          >
            <TableRow>
              <TableCell 
                sx={{ 
                  fontWeight: 700, 
                  color: isDarkMode ? DARK_MODE.text : 'inherit',
                  borderBottom: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none',
                  py: 1.5
                }}
              >
                Title
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 700, 
                  color: isDarkMode ? DARK_MODE.text : 'inherit',
                  borderBottom: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none',
                  py: 1.5
                }}
              >
                Status
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 700, 
                  color: isDarkMode ? DARK_MODE.text : 'inherit',
                  borderBottom: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none',
                  py: 1.5
                }}
              >
                Date
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 700, 
                  color: isDarkMode ? DARK_MODE.text : 'inherit',
                  borderBottom: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none',
                  py: 1.5
                }}
              >
                Time
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 700, 
                  color: isDarkMode ? DARK_MODE.text : 'inherit',
                  borderBottom: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none',
                  py: 1.5
                }}
              >
                Participants
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 700, 
                  color: isDarkMode ? DARK_MODE.text : 'inherit',
                  borderBottom: isDarkMode ? `1px solid ${DARK_MODE.border}` : 'none',
                  py: 1.5
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {meetings.map((meeting) => (
              <TableRow 
                key={meeting.id} 
                hover
                sx={{
                  '&:hover': {
                    bgcolor: isDarkMode ? DARK_MODE.hover : 'action.hover',
                  },
                  '&:last-child td, &:last-child th': {
                    borderBottom: 'none',
                  },
                }}
              >
                <TableCell 
                  sx={{ 
                    borderBottom: isDarkMode ? `1px solid ${DARK_MODE.borderLight}` : 'none',
                    py: 1.5
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography 
                      variant="body2" 
                      fontWeight={600}
                      sx={{ 
                        color: isDarkMode ? DARK_MODE.text : 'inherit',
                      }}
                    >
                      {meeting.title}
                    </Typography>
                    {(meeting.is_recurring || meeting.recurring_meeting_id) && (
                      <Chip 
                        label="Recurring" 
                        size="small" 
                        icon={<RepeatIcon sx={{ fontSize: 12 }} />} 
                        sx={{ 
                          height: 20, 
                          fontSize: '0.65rem',
                          bgcolor: isDarkMode ? alpha(DARK_MODE.primary, 0.15) : 'primary.light',
                          color: isDarkMode ? DARK_MODE.primary : 'primary.main',
                          '& .MuiChip-icon': {
                            color: isDarkMode ? DARK_MODE.primary : 'primary.main',
                          }
                        }} 
                      />
                    )}
                  </Stack>
                </TableCell>
                <TableCell 
                  sx={{ 
                    borderBottom: isDarkMode ? `1px solid ${DARK_MODE.borderLight}` : 'none',
                    py: 1.5
                  }}
                >
                  <StatusChip 
                    status={meeting.status} 
                    size="small"
                    isDarkMode={isDarkMode}
                  />
                </TableCell>
                <TableCell 
                  sx={{ 
                    color: isDarkMode ? DARK_MODE.text : 'inherit',
                    borderBottom: isDarkMode ? `1px solid ${DARK_MODE.borderLight}` : 'none',
                    py: 1.5
                  }}
                >
                  {formatDate(meeting.meeting_date)}
                </TableCell>
                <TableCell 
                  sx={{ 
                    color: isDarkMode ? DARK_MODE.text : 'inherit',
                    borderBottom: isDarkMode ? `1px solid ${DARK_MODE.borderLight}` : 'none',
                    py: 1.5
                  }}
                >
                  {formatTime(meeting.start_time)}
                </TableCell>
                <TableCell 
                  sx={{ 
                    color: isDarkMode ? DARK_MODE.text : 'inherit',
                    borderBottom: isDarkMode ? `1px solid ${DARK_MODE.borderLight}` : 'none',
                    py: 1.5
                  }}
                >
                  <Chip 
                    label={meeting.participants_count || 0} 
                    size="small"
                    sx={{
                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'grey.100',
                      color: isDarkMode ? DARK_MODE.text : 'inherit',
                      minWidth: 28,
                      fontWeight: 600,
                    }}
                  />
                </TableCell>
                <TableCell 
                  sx={{ 
                    borderBottom: isDarkMode ? `1px solid ${DARK_MODE.borderLight}` : 'none',
                    py: 1.5
                  }}
                >
                  <Stack direction="row" spacing={0.5}>
                    <IconButton 
                      size="small" 
                      onClick={() => onView(meeting.id)}
                      sx={{
                        color: isDarkMode ? DARK_MODE.textSecondary : 'inherit',
                        '&:hover': {
                          bgcolor: isDarkMode ? alpha(DARK_MODE.primary, 0.1) : 'action.hover',
                          color: isDarkMode ? DARK_MODE.primary : 'primary.main',
                        }
                      }}
                    >
                      <ArrowForwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => onEdit(meeting.id)}
                      sx={{
                        color: isDarkMode ? DARK_MODE.textSecondary : 'inherit',
                        '&:hover': {
                          bgcolor: isDarkMode ? alpha(DARK_MODE.primary, 0.1) : 'action.hover',
                          color: isDarkMode ? DARK_MODE.primary : 'secondary.main',
                        }
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => onNotify(meeting)}
                      sx={{
                        color: isDarkMode ? DARK_MODE.textSecondary : 'inherit',
                        '&:hover': {
                          bgcolor: isDarkMode ? alpha(DARK_MODE.primary, 0.1) : 'action.hover',
                          color: isDarkMode ? DARK_MODE.primary : 'info.main',
                        }
                      }}
                    >
                      <NotificationsIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};