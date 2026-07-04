// src/components/actiontracker/meetings/components/MeetingTableView.jsx
import {
  Paper, Table, TableContainer, TableHead, TableBody, TableRow,
  TableCell, Stack, Typography, Chip, IconButton
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Edit from '@mui/icons-material/Edit';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RepeatIcon from '@mui/icons-material/Repeat';
import { StatusChip } from './StatusChip';
import { formatDate, formatTime } from '../utils/helpers';

export const MeetingTableView = ({ meetings, onView, onEdit, onNotify }) => {
  return (
    <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <TableContainer>
        <Table>
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Participants</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {meetings.map(meeting => (
              <TableRow key={meeting.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" fontWeight={600}>{meeting.title}</Typography>
                    {(meeting.is_recurring || meeting.recurring_meeting_id) && (
                      <Chip label="Recurring" size="small" icon={<RepeatIcon sx={{ fontSize: 12 }} />} sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <StatusChip status={meeting.status} size="small" />
                </TableCell>
                <TableCell>{formatDate(meeting.meeting_date)}</TableCell>
                <TableCell>{formatTime(meeting.start_time)}</TableCell>
                <TableCell>{meeting.participants_count || 0}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => onView(meeting.id)}><ArrowForwardIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => onEdit(meeting.id)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => onNotify(meeting)}><NotificationsIcon fontSize="small" /></IconButton>
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