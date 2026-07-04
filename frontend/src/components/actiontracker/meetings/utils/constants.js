// src/components/meetings/utils/constants.js
import {
  Pending as PendingIcon,
  PlayCircle as PlayCircleIcon,
  StopCircle as StopCircleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as Cancel,
  Schedule as ScheduleOutlinedIcon,
  AccessTime as AccessTimeIcon,
  Repeat as RepeatIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material';
import { COLORS } from '../styles/colors';

export const STATUS_CONFIG = {
  'ended': { label: 'Ended', icon: <StopCircleIcon sx={{ fontSize: 14 }} />, color: COLORS.ended, bgColor: alpha(COLORS.ended, 0.1) },
  'started': { label: 'In Progress', icon: <PlayCircleIcon sx={{ fontSize: 14 }} />, color: COLORS.started, bgColor: alpha(COLORS.started, 0.1) },
  'ongoing': { label: 'Ongoing', icon: <PlayCircleIcon sx={{ fontSize: 14 }} />, color: COLORS.ongoing, bgColor: alpha(COLORS.ongoing, 0.1) },
  'in_progress': { label: 'In Progress', icon: <PlayCircleIcon sx={{ fontSize: 14 }} />, color: COLORS.in_progress, bgColor: alpha(COLORS.in_progress, 0.1) },
  'pending': { label: 'Pending', icon: <PendingIcon sx={{ fontSize: 14 }} />, color: COLORS.pending, bgColor: alpha(COLORS.pending, 0.1) },
  'scheduled': { label: 'Scheduled', icon: <ScheduleOutlinedIcon sx={{ fontSize: 14 }} />, color: COLORS.scheduled, bgColor: alpha(COLORS.scheduled, 0.1) },
  'completed': { label: 'Completed', icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, color: COLORS.completed, bgColor: alpha(COLORS.completed, 0.1) },
  'closed': { label: 'Closed', icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, color: COLORS.closed, bgColor: alpha(COLORS.closed, 0.1) },
  'cancelled': { label: 'Cancelled', icon: <Cancel sx={{ fontSize: 14 }} />, color: COLORS.cancelled, bgColor: alpha(COLORS.cancelled, 0.1) },
  'awaiting': { label: 'Awaiting', icon: <AccessTimeIcon sx={{ fontSize: 14 }} />, color: COLORS.awaiting, bgColor: alpha(COLORS.awaiting, 0.1) },
  'postponed': { label: 'Postponed', icon: <AccessTimeIcon sx={{ fontSize: 14 }} />, color: COLORS.postponed, bgColor: alpha(COLORS.postponed, 0.1) },
  'recurring': { label: 'Recurring', icon: <RepeatIcon sx={{ fontSize: 14 }} />, color: COLORS.recurring, bgColor: alpha(COLORS.recurring, 0.1) }
};

export const DEFAULT_PAGINATION = {
  page: 1,
  rowsPerPage: 10,
  total: 0
};

export const SORT_OPTIONS = {
  DATE: 'meeting_date',
  TITLE: 'title',
  STATUS: 'status'
};