// src/components/actiontracker/meetings/MeetingMinutes.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Button,
  IconButton,
  Divider,
  Chip,
  Alert,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Tooltip,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Skeleton,
  LinearProgress,
  alpha,
  Snackbar,
  useMediaQuery,
  useTheme,
  Grow,
  Zoom,
  Badge,
  Collapse,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Warning as WarningIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  AccessTime as AccessTimeIcon,
  Notes as NotesIcon,
  AutoAwesome as AutoAwesomeIcon,
  Lock as LockIcon,
  CloudUpload as CloudUploadIcon,
  Search as SearchIcon,
  PlaylistAddCheck as PlaylistAddCheckIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Info as InfoIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../../../services/api';
import {
  fetchMeetingMinutes,
  createMeetingMinutes,
  deleteMeetingMinutes,
  clearMinutesError,
  selectMeetingMinutes,
  selectMinutesLoading,
  selectMinutesError,
} from '../../../store/slices/actionTracker/meetingSlice';
import AddActionDialog from './components/AddActionDialog';
import EditActionDialog from './components/EditActionDialog';
import EditMinuteDialog from './components/EditMinuteDialog';
import RichTextEditor from './components/RichTextEditor';
import { parseWordDocument } from '../../../utils/minutesParser';
import { selectUserPermissions, hasPermission } from '../../../store/slices/authSlice';

// ==================== Permission Constants ====================
const PERMISSIONS = {
  // Minutes permissions
  ADD_MINUTES: 'minutes:add',
  EDIT_MINUTES: 'minutes:edit',
  DELETE_MINUTES: 'minutes:delete',
  APPROVE_MINUTES: 'minutes:approve',
  SIGN_MINUTES: 'minutes:sign',
  VIEW_MINUTES: 'minutes:view',
  EXPORT_MINUTES: 'minutes:export',
  
  // Actions permissions
  CREATE_ACTIONS: 'action:create',
  UPDATE_ACTIONS: 'action:update',
  DELETE_ACTIONS: 'action:delete',
  ASSIGN_ACTIONS: 'action:assign',
  COMMENT_ACTIONS: 'action:comment',
  UPDATE_ACTION_STATUS: 'action:status_update',
  UPDATE_ACTION_PRIORITY: 'action:priority_update',
  VIEW_ALL_ACTIONS: 'action:view_all',
  VIEW_OWN_ACTIONS: 'action:view_own',
  ADD_ACTION_ATTACHMENTS: 'action:attachment',
  
  // Meeting permissions
  CHANGE_STATUS: 'meeting:status_change',
  RECORD_MEETING: 'meeting:record',
  VIEW_RECORDER: 'meeting:view_recorder',
};

// ==================== Helper Functions ====================
const formatDate = (dateString) => {
  if (!dateString) return 'Date not set';
  const date = new Date(dateString);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `Today at ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, yyyy • h:mm a');
};

const getStatusConfig = (action) => {
  const isOverdue =
    action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const isCompleted =
    action.completed_at || action.overall_progress_percentage >= 100;

  if (isCompleted)
    return { label: 'Completed', color: 'success', icon: <CheckCircleIcon fontSize="small" /> };
  if (isOverdue)
    return { label: 'Overdue', color: 'error', icon: <WarningIcon fontSize="small" /> };
  if (action.overall_status_name === 'in_progress')
    return { label: 'In Progress', color: 'info', icon: <PendingIcon fontSize="small" /> };
  return { label: 'Pending', color: 'warning', icon: <ScheduleIcon fontSize="small" /> };
};

const canEditMinutesByStatus = (meetingStatus) => {
  if (!meetingStatus) return false;
  const s = String(meetingStatus).toLowerCase();
  return ['started', 'ongoing', 'in_progress', 'in progress'].some((x) => s.includes(x));
};

// ==================== RichTextContent Component ====================
const RichTextContent = ({ content }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  if (!content || content.trim() === '' || content === '<p></p>') {
    return (
      <Typography
        variant="body2"
        sx={{ fontStyle: 'italic', color: dark ? '#9CA3AF' : 'text.secondary' }}
      >
        No content provided.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        lineHeight: 1.7,
        color: dark ? '#E5E7EB' : 'text.primary',
        '& p': { margin: '0 0 10px 0', '&:last-child': { mb: 0 } },
        '& ul, & ol': { pl: '22px', my: 1 },
        '& li': { mb: '4px' },
        '& h1,& h2,& h3': { mt: 2, mb: 1, fontWeight: 600 },
        '& strong,& b': { fontWeight: 700 },
        '& a': { color: dark ? '#A78BFA' : '#7C3AED' },
        '& blockquote': {
          pl: 2,
          borderLeft: `4px solid ${dark ? '#A78BFA' : '#7C3AED'}`,
          fontStyle: 'italic',
          color: dark ? '#9CA3AF' : 'text.secondary',
        },
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

// ==================== ActionRow Component ====================
const ActionRow = ({ action, onEdit, canEditActions, canViewAllActions, currentUserId }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const isOverdue =
    action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const statusConfig = getStatusConfig(action);

  // Check if user can view this action (either view_all or is assigned to them)
  const canViewAction = canViewAllActions || action.assigned_to_id === currentUserId;
  
  // Check if user can edit this action
  const canEditThisAction = canEditActions && (canViewAllActions || action.assigned_to_id === currentUserId);

  let assignedToName = 'Unassigned';
  if (action.assigned_to?.full_name) assignedToName = action.assigned_to.full_name;
  else if (action.assigned_to?.username) assignedToName = action.assigned_to.username;
  else if (typeof action.assigned_to_name === 'string') assignedToName = action.assigned_to_name;
  else if (action.assigned_to_name?.name) assignedToName = action.assigned_to_name.name;

  const progress = action.overall_progress_percentage || 0;

  if (!canViewAction) return null;

  return (
    <TableRow
      hover
      sx={{ '&:hover': { bgcolor: dark ? alpha('#FFF', 0.05) : alpha('#000', 0.02) } }}
    >
      <TableCell sx={{ pl: 2 }}>
        <Typography variant="body2" fontWeight={500} sx={{ color: dark ? '#FFF' : 'inherit' }}>
          {action.description}
        </Typography>
        {action.remarks && (
          <Typography
            variant="caption"
            sx={{ mt: 0.5, display: 'block', color: dark ? '#9CA3AF' : 'text.secondary' }}
          >
            {action.remarks}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: dark ? alpha('#A78BFA', 0.2) : 'primary.light',
              fontSize: '0.75rem',
              color: dark ? '#A78BFA' : 'primary.main',
            }}
          >
            {assignedToName?.[0]?.toUpperCase() || '?'}
          </Avatar>
          <Typography variant="body2" sx={{ color: dark ? '#D1D5DB' : 'inherit' }}>
            {assignedToName}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AccessTimeIcon
            fontSize="small"
            sx={{
              color: isOverdue
                ? dark ? '#F87171' : 'error.main'
                : dark ? '#6B7280' : 'action.active',
            }}
          />
          <Typography
            variant="body2"
            sx={{
              color: isOverdue
                ? dark ? '#F87171' : 'error.main'
                : dark ? '#D1D5DB' : 'inherit',
            }}
          >
            {action.due_date ? format(new Date(action.due_date), 'MMM d, yyyy') : 'No due date'}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Chip
          size="small"
          label={statusConfig.label}
          color={statusConfig.color}
          icon={statusConfig.icon}
          sx={{ height: 26, fontWeight: 500 }}
        />
      </TableCell>
      <TableCell sx={{ minWidth: 120 }}>
        <Stack spacing={0.5}>
          <Typography variant="caption" fontWeight={500} sx={{ color: dark ? '#9CA3AF' : 'inherit' }}>
            {progress}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: dark ? '#374151' : '#E2E8F0',
              '& .MuiLinearProgress-bar': {
                bgcolor:
                  statusConfig.label === 'Completed'
                    ? '#10B981'
                    : isOverdue
                    ? '#EF4444'
                    : dark
                    ? '#A78BFA'
                    : '#3B82F6',
              },
            }}
          />
        </Stack>
      </TableCell>
      <TableCell align="center">
        <Tooltip title={canEditThisAction ? 'Edit Action' : 'You do not have permission to edit this action'}>
          <span>
            <IconButton
              size="small"
              onClick={() => onEdit(action.id)}
              disabled={!canEditThisAction}
              sx={{
                color: dark ? '#A78BFA' : 'primary.main',
                '&:hover': { bgcolor: dark ? alpha('#A78BFA', 0.1) : alpha('#7C3AED', 0.1) },
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

// ==================== MinutesCard Component ====================
const MinutesCard = ({
  minute,
  expanded,
  onToggle,
  onAddAction,
  onEditAction,
  onEditMinute,
  onMenuOpen,
  canEditMinutes,
  canDeleteMinutes,
  canCreateActions,
  canEditActions,
  canViewAllActions,
  currentUserId,
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const minuteId = minute.id;
  const title = minute.topic || minute.title || 'Untitled Minutes';
  const discussion = minute.discussion || minute.content || '';
  const decisions = minute.decisions || '';
  const timestamp = minute.timestamp || minute.created_at;
  const actionCount = minute.actions?.length || 0;
  const completedActions =
    minute.actions?.filter((a) => a.completed_at || a.overall_progress_percentage >= 100)
      .length || 0;
  const recordedByName = minute.recorded_by_name || minute.created_by_name;

  // Filter actions based on permissions
  const visibleActions = minute.actions?.filter((action) => {
    if (canViewAllActions) return true;
    return action.assigned_to_id === currentUserId;
  }) || [];

  return (
    <Zoom in timeout={300}>
      <Accordion
        expanded={expanded}
        onChange={onToggle}
        sx={{
          borderRadius: 2,
          '&:before': { display: 'none' },
          boxShadow: expanded ? 3 : 1,
          bgcolor: dark ? '#1F2937' : '#FFF',
          transition: 'all 0.3s ease',
          '&:hover': { boxShadow: 4 },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ color: dark ? '#9CA3AF' : 'inherit' }} />}
          sx={{
            '&:hover': { bgcolor: dark ? alpha('#FFF', 0.05) : alpha('#000', 0.02) },
            borderRadius: expanded ? '8px 8px 0 0' : '8px',
            '& .MuiAccordionSummary-content': {
              marginRight: (canEditMinutes || canDeleteMinutes) ? 0 : 2,
            },
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
            <Avatar
              sx={{
                bgcolor: dark ? alpha('#A78BFA', 0.2) : 'primary.main',
                color: dark ? '#A78BFA' : '#FFF',
                width: 40,
                height: 40,
              }}
            >
              <DescriptionIcon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ color: dark ? '#FFF' : 'inherit' }}
              >
                {title}
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Typography variant="caption" sx={{ color: dark ? '#9CA3AF' : 'text.secondary' }}>
                  {formatDate(timestamp)}
                </Typography>
                {recordedByName && (
                  <Typography
                    variant="caption"
                    sx={{ color: dark ? '#9CA3AF' : 'text.secondary' }}
                  >
                    Recorded by: {recordedByName}
                  </Typography>
                )}
                <Badge
                  badgeContent={visibleActions.length}
                  color="primary"
                  sx={{ '& .MuiBadge-badge': { bgcolor: dark ? '#A78BFA' : undefined } }}
                >
                  <AssignmentIcon
                    fontSize="small"
                    sx={{ color: dark ? '#9CA3AF' : 'text.secondary' }}
                  />
                </Badge>
              </Stack>
            </Box>
          </Stack>
        </AccordionSummary>

        {/* Action Buttons - OUTSIDE AccordionSummary */}
        {(canEditMinutes || canDeleteMinutes) && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, pt: 1, gap: 0.5 }}>
            {canEditMinutes && (
              <Tooltip title="Edit Minutes">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onEditMinute(minute); }}
                  sx={{ color: dark ? '#A78BFA' : 'primary.main' }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="More Options">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onMenuOpen(e, minute); }}
                sx={{ color: dark ? '#9CA3AF' : 'inherit' }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <AccordionDetails sx={{ pt: 0 }}>
          <Divider sx={{ mb: 3, borderColor: dark ? '#374151' : '#E5E7EB' }} />
          <Stack spacing={4}>
            {/* Discussion */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <NotesIcon fontSize="small" sx={{ color: dark ? '#A78BFA' : 'primary.main' }} />
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{ color: dark ? '#FFF' : 'inherit' }}
                >
                  Discussion
                </Typography>
              </Stack>
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  bgcolor: dark ? alpha('#FFF', 0.03) : '#F8FAFC',
                  borderRadius: 2,
                  borderColor: dark ? '#374151' : '#E5E7EB',
                }}
              >
                <RichTextContent content={discussion} />
              </Paper>
            </Box>

            {/* Decisions */}
            {decisions && decisions !== '<p></p>' && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <AssignmentIcon
                    fontSize="small"
                    sx={{ color: dark ? '#34D399' : 'success.main' }}
                  />
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{ color: dark ? '#34D399' : 'success.main' }}
                  >
                    Decisions
                  </Typography>
                </Stack>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    bgcolor: dark ? alpha('#34D399', 0.05) : '#F0FDF4',
                    borderRadius: 2,
                    borderColor: dark ? alpha('#34D399', 0.2) : '#E5E7EB',
                  }}
                >
                  <RichTextContent content={decisions} />
                </Paper>
              </Box>
            )}

            {/* Actions */}
            <Box>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <PlaylistAddCheckIcon
                    fontSize="small"
                    sx={{ color: dark ? '#A78BFA' : 'primary.main' }}
                  />
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{ color: dark ? '#FFF' : 'inherit' }}
                  >
                    Action Items
                  </Typography>
                  {visibleActions.length > 0 && (
                    <Chip
                      label={`${completedActions}/${visibleActions.length} completed`}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{
                        borderColor: dark ? '#34D399' : undefined,
                        color: dark ? '#34D399' : undefined,
                      }}
                    />
                  )}
                </Stack>
                {canCreateActions && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => onAddAction(minuteId)}
                    sx={{
                      bgcolor: '#7C3AED',
                      '&:hover': { bgcolor: '#6D28D9' },
                    }}
                  >
                    Add Action
                  </Button>
                )}
              </Stack>

              {visibleActions.length > 0 ? (
                <TableContainer
                  component={Paper}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: dark ? '#374151' : '#E5E7EB',
                    bgcolor: dark ? '#1F2937' : '#FFF',
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: dark ? alpha('#A78BFA', 0.1) : '#F1F5F9' }}>
                        {['Description', 'Assigned To', 'Due Date', 'Status', 'Progress', 'Actions'].map(
                          (h) => (
                            <TableCell
                              key={h}
                              align={h === 'Actions' ? 'center' : 'left'}
                              sx={{ fontWeight: 700, color: dark ? '#FFF' : 'inherit' }}
                            >
                              {h}
                            </TableCell>
                          )
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {minute.actions.map((action) => (
                        <ActionRow
                          key={action.id}
                          action={action}
                          onEdit={onEditAction}
                          canEditActions={canEditActions}
                          canViewAllActions={canViewAllActions}
                          currentUserId={currentUserId}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    bgcolor: dark ? alpha('#FFF', 0.03) : '#FAFAFA',
                    borderColor: dark ? '#374151' : '#E5E7EB',
                  }}
                >
                  <AssignmentIcon sx={{ fontSize: 48, color: dark ? '#6B7280' : '#CBD5E1', mb: 2 }} />
                  <Typography variant="body2" sx={{ color: dark ? '#9CA3AF' : 'text.secondary' }}>
                    No action items available.
                  </Typography>
                  {canCreateActions && (
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => onAddAction(minuteId)}
                      sx={{ mt: 2, color: dark ? '#A78BFA' : 'primary.main' }}
                    >
                      Create First Action
                    </Button>
                  )}
                </Paper>
              )}
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Zoom>
  );
};

// ==================== Loading Skeleton ====================
const LoadingSkeleton = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  return (
    <Stack spacing={2}>
      {[1, 2, 3].map((i) => (
        <Paper key={i} sx={{ p: 2, borderRadius: 2, bgcolor: dark ? '#1F2937' : '#FFF' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: dark ? '#374151' : undefined }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={24} sx={{ bgcolor: dark ? '#374151' : undefined }} />
              <Skeleton variant="text" width="30%" height={20} sx={{ bgcolor: dark ? '#374151' : undefined }} />
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
};

// ==================== Empty State ====================
const EmptyState = ({ canAddMinutes, statusMessage, onAddClick }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  return (
    <Grow in timeout={500}>
      <Paper
        sx={{
          p: 8,
          textAlign: 'center',
          borderRadius: 3,
          bgcolor: dark ? '#1F2937' : '#FFF',
          border: `1px solid ${dark ? '#374151' : '#E5E7EB'}`,
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 80, color: dark ? '#6B7280' : '#CBD5E1', mb: 2 }} />
        <Typography variant="h6" sx={{ color: dark ? '#FFF' : 'text.secondary' }} gutterBottom>
          No Minutes Yet
        </Typography>
        <Typography variant="body2" sx={{ color: dark ? '#9CA3AF' : 'text.secondary', mb: 3 }}>
          {canAddMinutes
            ? 'Start by adding the first meeting minutes'
            : statusMessage || 'Minutes can only be added once the meeting is in progress'}
        </Typography>
        {canAddMinutes && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAddClick}
            size="large"
            sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
          >
            Add First Minutes
          </Button>
        )}
      </Paper>
    </Grow>
  );
};

// ==================== ParsedMinuteRow Component ====================
const ParsedMinuteRow = ({ entry, selected, onToggle, onFieldChange, dark }) => {
  const [open, setOpen] = useState(false);

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1.5,
        borderRadius: 2,
        borderColor: selected
          ? dark ? '#A78BFA' : '#7C3AED'
          : dark ? '#374151' : '#E5E7EB',
        bgcolor: selected
          ? dark ? alpha('#A78BFA', 0.08) : alpha('#7C3AED', 0.04)
          : dark ? '#111827' : '#FAFAFA',
        transition: 'all 0.2s',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.5, cursor: 'pointer' }}
        onClick={() => onToggle(entry.id)}
      >
        <Checkbox
          checked={selected}
          onChange={() => onToggle(entry.id)}
          onClick={(e) => e.stopPropagation()}
          size="small"
          sx={{ color: dark ? '#6B7280' : undefined }}
          icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
          checkedIcon={<CheckBoxIcon fontSize="small" sx={{ color: dark ? '#A78BFA' : '#7C3AED' }} />}
        />
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 1,
            bgcolor: dark ? alpha('#A78BFA', 0.15) : alpha('#7C3AED', 0.1),
            color: dark ? '#A78BFA' : '#7C3AED',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          Min {entry.minuteNumber}
        </Typography>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ flex: 1, color: dark ? '#F3F4F6' : '#111827' }}
          noWrap
        >
          {entry.title}
        </Typography>
        {entry.actionItems?.length > 0 && (
          <Chip
            label={`${entry.actionItems.length} action${entry.actionItems.length > 1 ? 's' : ''}`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.68rem',
              bgcolor: dark ? alpha('#F59E0B', 0.15) : '#FEF3C7',
              color: dark ? '#FBBF24' : '#92400E',
            }}
          />
        )}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          sx={{ color: dark ? '#6B7280' : '#9CA3AF' }}
        >
          {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Collapse in={open}>
        <Divider sx={{ borderColor: dark ? '#374151' : '#E5E7EB' }} />
        <Stack spacing={2} sx={{ p: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Topic"
            value={entry.title}
            onChange={(e) => onFieldChange(entry.id, 'title', e.target.value)}
          />
          <Box>
            <Typography variant="caption" sx={{ color: dark ? '#9CA3AF' : '#6B7280', mb: 0.5, display: 'block' }}>
              Discussion (HTML preview)
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                maxHeight: 160,
                overflow: 'auto',
                bgcolor: dark ? alpha('#FFF', 0.03) : '#F8FAFC',
                borderColor: dark ? '#374151' : '#E5E7EB',
              }}
            >
              <RichTextContent content={entry.discussion} />
            </Paper>
          </Box>
          {entry.decisions && entry.decisions !== '<p></p>' && (
            <Box>
              <Typography variant="caption" sx={{ color: dark ? '#9CA3AF' : '#6B7280', mb: 0.5, display: 'block' }}>
                Decisions
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  maxHeight: 120,
                  overflow: 'auto',
                  bgcolor: dark ? alpha('#34D399', 0.05) : '#F0FDF4',
                  borderColor: dark ? alpha('#34D399', 0.2) : '#E5E7EB',
                }}
              >
                <RichTextContent content={entry.decisions} />
              </Paper>
            </Box>
          )}
          {entry.actionItems?.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ color: dark ? '#9CA3AF' : '#6B7280', mb: 0.5, display: 'block' }}>
                Detected Action Items (add manually after import)
              </Typography>
              <Stack spacing={0.5}>
                {entry.actionItems.map((a, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    sx={{
                      display: 'block',
                      p: '4px 8px',
                      borderRadius: 1,
                      bgcolor: dark ? alpha('#F59E0B', 0.08) : '#FFFBEB',
                      color: dark ? '#FCD34D' : '#78350F',
                    }}
                  >
                    • {typeof a === 'string' ? a : a.description}
                    {a.assignedTo ? ` — ${a.assignedTo}` : ''}
                    {a.dueDate ? ` (by ${a.dueDate})` : ''}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
};

// ==================== Main Component ====================
const MeetingMinutes = ({ meetingId, meetingStatus, onRefresh }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dark = theme.palette.mode === 'dark';

  // Redux state
  const minutesList = useSelector(selectMeetingMinutes);
  const isLoading = useSelector(selectMinutesLoading);
  const error = useSelector(selectMinutesError);
  const userPermissions = useSelector(selectUserPermissions);
  const currentUser = useSelector((state) => state.auth.user);

  // Permission checks
  const canAddMinutes = hasPermission(userPermissions, PERMISSIONS.ADD_MINUTES);
  const canEditMinutes = hasPermission(userPermissions, PERMISSIONS.EDIT_MINUTES);
  const canDeleteMinutes = hasPermission(userPermissions, PERMISSIONS.DELETE_MINUTES);
  const canViewMinutes = hasPermission(userPermissions, PERMISSIONS.VIEW_MINUTES);
  const canExportMinutes = hasPermission(userPermissions, PERMISSIONS.EXPORT_MINUTES);
  const canCreateActions = hasPermission(userPermissions, PERMISSIONS.CREATE_ACTIONS);
  const canEditActions = hasPermission(userPermissions, PERMISSIONS.UPDATE_ACTIONS);
  const canViewAllActions = hasPermission(userPermissions, PERMISSIONS.VIEW_ALL_ACTIONS);
  
  // Check if user can edit based on meeting status (only active meetings)
  const canEditByStatus = canEditMinutesByStatus(meetingStatus);
  
  // Combined permissions
  const canAddMinutesWithStatus = canAddMinutes && canEditByStatus;
  const canEditMinutesWithStatus = canEditMinutes && canEditByStatus;
  const canDeleteMinutesWithStatus = canDeleteMinutes && canEditByStatus;
  const canCreateActionsWithStatus = canCreateActions && canEditByStatus;
  const canEditActionsWithStatus = canEditActions && canEditByStatus;

  // UI state
  const [expandedMinute, setExpandedMinute] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddActionDialog, setShowAddActionDialog] = useState(false);
  const [showEditActionDialog, setShowEditActionDialog] = useState(false);
  const [showEditMinuteDialog, setShowEditMinuteDialog] = useState(false);
  const [selectedMinuteId, setSelectedMinuteId] = useState(null);
  const [selectedMinute, setSelectedMinute] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [newMinutes, setNewMinutes] = useState({ topic: '', discussion: '', decisions: '' });
  const [submitting, setSubmitting] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Upload / import state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [parsedEntries, setParsedEntries] = useState([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState(new Set());
  const [importProgress, setImportProgress] = useState(null);

  const getStatusMessage = () => {
    if (!meetingStatus) return null;
    const s = String(meetingStatus).toLowerCase();
    if (s === 'scheduled' || s === 'pending')
      return "Meeting hasn't started yet. Minutes can only be added once the meeting is in progress.";
    if (s === 'cancelled') return 'Meeting has been cancelled. Minutes cannot be added or edited.';
    if (s === 'ended' || s === 'closed') return 'Meeting has ended. Minutes are now read-only.';
    return null;
  };

  const fetchMinutes = useCallback(() => {
    if (meetingId && canViewMinutes) {
      dispatch(fetchMeetingMinutes(meetingId));
    }
  }, [dispatch, meetingId, canViewMinutes]);

  useEffect(() => {
    if (meetingId && canViewMinutes) fetchMinutes();
  }, [meetingId, fetchMinutes, canViewMinutes]);

  const handleRefresh = () => {
    fetchMinutes();
    if (onRefresh) onRefresh();
  };

  // Add minutes (manual)
  const handleAddMinutes = async () => {
    if (!canAddMinutesWithStatus) {
      setSnackbar({ open: true, message: 'You do not have permission to add minutes', severity: 'error' });
      return;
    }
    if (!newMinutes.topic.trim()) {
      setSnackbar({ open: true, message: 'Please enter a topic', severity: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(createMeetingMinutes({ meetingId, data: newMinutes })).unwrap();
      setShowAddDialog(false);
      setNewMinutes({ topic: '', discussion: '', decisions: '' });
      setSnackbar({ open: true, message: 'Minutes added successfully!', severity: 'success' });
      fetchMinutes();
      if (onRefresh) onRefresh();
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Failed to add minutes', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Action helpers
  const handleAddAction = (minuteId) => {
    if (!canCreateActionsWithStatus) {
      setSnackbar({ open: true, message: 'You do not have permission to create actions', severity: 'error' });
      return;
    }
    setSelectedMinuteId(minuteId);
    setShowAddActionDialog(true);
  };

  const handleEditAction = (actionId) => {
    if (!canEditActionsWithStatus) {
      setSnackbar({ open: true, message: 'You do not have permission to edit actions', severity: 'error' });
      return;
    }
    let action = null;
    for (const m of minutesList) {
      action = m.actions?.find((a) => a.id === actionId);
      if (action) break;
    }
    setSelectedAction(action);
    setShowEditActionDialog(true);
  };

  const handleEditMinute = (minute) => {
    if (!canEditMinutesWithStatus) {
      setSnackbar({ open: true, message: 'You do not have permission to edit minutes', severity: 'error' });
      return;
    }
    setSelectedMinute(minute);
    setShowEditMinuteDialog(true);
  };

  const handleActionCreated = () => {
    fetchMinutes();
    setSnackbar({ open: true, message: 'Action created successfully!', severity: 'success' });
  };

  const handleActionUpdated = () => {
    fetchMinutes();
    setSnackbar({ open: true, message: 'Action updated successfully!', severity: 'success' });
  };

  const handleMinuteUpdated = () => {
    fetchMinutes();
    setSnackbar({ open: true, message: 'Minutes updated successfully!', severity: 'success' });
  };

  // Menu handlers
  const handleMenuOpen = (event, minute) => {
    setAnchorEl(event.currentTarget);
    setSelectedMinute(minute);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMinute(null);
  };

  const handleDeleteMinutes = async () => {
    if (!canDeleteMinutesWithStatus) {
      setSnackbar({ open: true, message: 'You do not have permission to delete minutes', severity: 'error' });
      handleMenuClose();
      return;
    }
    if (!selectedMinute?.id) return;
    if (!window.confirm(`Delete "${selectedMinute.topic || 'this minute'}" and all its actions?`)) {
      handleMenuClose();
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/action-tracker/minutes/${selectedMinute.id}`);
      handleMenuClose();
      setSnackbar({ open: true, message: 'Minutes deleted successfully!', severity: 'success' });
      fetchMinutes();
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete minutes', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleMinute = (minuteId) => {
    setExpandedMinute(expandedMinute === minuteId ? null : minuteId);
  };

  // Upload & parse
  const handleFileSelect = async (event) => {
    if (!canAddMinutesWithStatus) {
      setSnackbar({ open: true, message: 'You do not have permission to upload minutes', severity: 'error' });
      return;
    }
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    if (!file.name.match(/\.(doc|docx)$/i)) {
      setSnackbar({
        open: true,
        message: 'Please upload a Word document (.doc or .docx)',
        severity: 'warning',
      });
      return;
    }

    setUploading(true);
    try {
      const parsed = await parseWordDocument(file);

      if (!parsed.minutes || parsed.minutes.length === 0) {
        setSnackbar({
          open: true,
          message: 'No minutes found in the document. Please check the format.',
          severity: 'warning',
        });
        return;
      }

      setParsedData(parsed);
      setParsedEntries(parsed.minutes.map((m) => ({ ...m })));
      setSelectedEntryIds(new Set(parsed.minutes.map((m) => m.id)));
      setUploadDialogOpen(true);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.message || 'Failed to parse document. Please check the format.',
        severity: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleToggleEntry = (id) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedEntryIds.size === parsedEntries.length) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(parsedEntries.map((e) => e.id)));
    }
  };

  const handleEntryFieldChange = (id, field, value) => {
    setParsedEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const handleImportMinutes = async () => {
    if (!canAddMinutesWithStatus) {
      setSnackbar({ open: true, message: 'You do not have permission to import minutes', severity: 'error' });
      return;
    }
    const toImport = parsedEntries.filter((e) => selectedEntryIds.has(e.id));
    if (toImport.length === 0) {
      setSnackbar({ open: true, message: 'Please select at least one minute to import', severity: 'warning' });
      return;
    }

    setSubmitting(true);
    setImportProgress({ done: 0, total: toImport.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < toImport.length; i++) {
      const entry = toImport[i];
      try {
        await dispatch(
          createMeetingMinutes({
            meetingId,
            data: {
              topic: entry.title || `Minute ${entry.minuteNumber}`,
              discussion: entry.discussion || '',
              decisions: entry.decisions || '',
            },
          })
        ).unwrap();
        successCount++;
      } catch {
        failCount++;
      }
      setImportProgress({ done: i + 1, total: toImport.length });
    }

    setSubmitting(false);
    setImportProgress(null);
    setUploadDialogOpen(false);
    setParsedData(null);
    setParsedEntries([]);
    setSelectedEntryIds(new Set());
    fetchMinutes();
    if (onRefresh) onRefresh();

    if (failCount === 0) {
      setSnackbar({
        open: true,
        message: `${successCount} minute${successCount > 1 ? 's' : ''} imported successfully!`,
        severity: 'success',
      });
    } else {
      setSnackbar({
        open: true,
        message: `Imported ${successCount}, failed ${failCount}. Please check the failed items.`,
        severity: 'warning',
      });
    }
  };

  // Filtered minutes (only show if user can view)
  const filteredMinutes = canViewMinutes ? minutesList.filter((m) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      m.topic?.toLowerCase().includes(s) ||
      m.discussion?.toLowerCase().includes(s) ||
      m.decisions?.toLowerCase().includes(s)
    );
  }) : [];

  const statusMessage = getStatusMessage();

  // Permission denial state
  if (!canViewMinutes) {
    return (
      <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: dark ? '#1F2937' : '#FFF' }}>
        <LockIcon sx={{ fontSize: 80, color: dark ? '#6B7280' : '#CBD5E1', mb: 2 }} />
        <Typography variant="h6" sx={{ color: dark ? '#FFF' : 'text.secondary' }} gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body2" sx={{ color: dark ? '#9CA3AF' : 'text.secondary' }}>
          You do not have permission to view meeting minutes.
        </Typography>
      </Paper>
    );
  }

  if (isLoading && minutesList.length === 0) return <LoadingSkeleton />;

  return (
    <Box>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ color: dark ? '#FFF' : 'inherit' }}>
          Meeting Minutes ({filteredMinutes.length})
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search minutes…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: isMobile ? '100%' : 200 }}
            slotProps={{
              input: {
                startAdornment: (
                  <SearchIcon fontSize="small" sx={{ color: dark ? '#9CA3AF' : '#6B7280', mr: 1 }} />
                ),
              }
            }}
          />

          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={isLoading} sx={{ color: dark ? '#D1D5DB' : 'inherit' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          {/* Upload button - requires add minutes permission */}
          {canAddMinutesWithStatus && (
            <Tooltip
              title={
                !canAddMinutesWithStatus
                  ? statusMessage || 'Meeting must be started to upload minutes'
                  : 'Upload minutes from a Word document'
              }
            >
              <span>
                <Button
                  variant="outlined"
                  component="label"
                  disabled={!canAddMinutesWithStatus || uploading}
                  startIcon={uploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                  sx={{
                    borderColor: dark ? '#A78BFA' : '#7C3AED',
                    color: dark ? '#A78BFA' : '#7C3AED',
                    '&:hover': {
                      borderColor: dark ? '#C4B5FD' : '#6D28D9',
                      bgcolor: dark ? alpha('#A78BFA', 0.1) : alpha('#7C3AED', 0.08),
                    },
                  }}
                >
                  <input
                    type="file"
                    hidden
                    accept=".doc,.docx"
                    onChange={handleFileSelect}
                    disabled={!canAddMinutesWithStatus}
                  />
                  {uploading ? 'Parsing…' : 'Upload Minutes'}
                </Button>
              </span>
            </Tooltip>
          )}

          {/* Add minutes button - requires add minutes permission */}
          {canAddMinutesWithStatus && (
            <Tooltip
              title={
                !canAddMinutesWithStatus
                  ? statusMessage || 'Meeting must be started to add minutes'
                  : 'Add meeting minutes'
              }
            >
              <span>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowAddDialog(true)}
                  disabled={!canAddMinutesWithStatus}
                  sx={{
                    bgcolor: '#7C3AED',
                    '&:hover': { bgcolor: '#6D28D9' },
                  }}
                >
                  Add Minutes
                </Button>
              </span>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {/* Alerts */}
      {statusMessage && (
        <Alert
          severity="info"
          icon={<LockIcon />}
          sx={{ mb: 2, borderRadius: 2, bgcolor: dark ? alpha('#3B82F6', 0.1) : undefined }}
        >
          {statusMessage}
        </Alert>
      )}
      {error && (
        <Alert
          severity="error"
          onClose={() => dispatch(clearMinutesError())}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* Minutes list or empty states */}
      {!isLoading && filteredMinutes.length === 0 ? (
        searchTerm ? (
          <Paper
            sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: dark ? '#1F2937' : '#FFF' }}
          >
            <SearchIcon sx={{ fontSize: 80, color: dark ? '#6B7280' : '#CBD5E1', mb: 2 }} />
            <Typography variant="h6" sx={{ color: dark ? '#FFF' : 'text.secondary' }} gutterBottom>
              No matching minutes found
            </Typography>
            <Typography variant="body2" sx={{ color: dark ? '#9CA3AF' : 'text.secondary' }}>
              Try adjusting your search terms
            </Typography>
          </Paper>
        ) : (
          <EmptyState
            canAddMinutes={canAddMinutesWithStatus}
            statusMessage={statusMessage}
            onAddClick={() => setShowAddDialog(true)}
          />
        )
      ) : (
        <Stack spacing={2}>
          {filteredMinutes.map((minute) => (
            <MinutesCard
              key={minute.id}
              minute={minute}
              expanded={expandedMinute === minute.id}
              onToggle={() => handleToggleMinute(minute.id)}
              onAddAction={handleAddAction}
              onEditAction={handleEditAction}
              onEditMinute={handleEditMinute}
              onMenuOpen={handleMenuOpen}
              canEditMinutes={canEditMinutesWithStatus}
              canDeleteMinutes={canDeleteMinutesWithStatus}
              canCreateActions={canCreateActionsWithStatus}
              canEditActions={canEditActionsWithStatus}
              canViewAllActions={canViewAllActions}
              currentUserId={currentUser?.id}
            />
          ))}
        </Stack>
      )}

      {/* Add Minutes Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => !submitting && setShowAddDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: { bgcolor: dark ? '#1F2937' : '#FFF', borderRadius: isMobile ? 0 : 2, backgroundImage: 'none' },
        }}
      >
        <DialogTitle
          sx={{ borderBottom: `1px solid ${dark ? '#374151' : '#E5E7EB'}`, p: isMobile ? 2 : 3 }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={600} sx={{ color: dark ? '#FFF' : '#111827' }}>
              Add Meeting Minutes
            </Typography>
            {!isMobile && (
              <IconButton
                onClick={() => !submitting && setShowAddDialog(false)}
                size="small"
                sx={{ color: dark ? '#9CA3AF' : '#6B7280' }}
              >
                <CloseIcon />
              </IconButton>
            )}
          </Stack>
          {submitting && <LinearProgress sx={{ mt: 2 }} />}
        </DialogTitle>

        <DialogContent sx={{ p: isMobile ? 2 : 3 }}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Topic *"
              value={newMinutes.topic}
              onChange={(e) => setNewMinutes({ ...newMinutes, topic: e.target.value })}
              required
              disabled={submitting}
              helperText="A descriptive title for these minutes"
            />
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ color: dark ? '#D1D5DB' : '#374151' }}>
                Discussion
              </Typography>
              <RichTextEditor
                value={newMinutes.discussion}
                onChange={(html) => setNewMinutes({ ...newMinutes, discussion: html })}
                placeholder="Record discussion points…"
                minHeight={220}
                disabled={submitting}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ color: dark ? '#D1D5DB' : '#374151' }}>
                Decisions (Optional)
              </Typography>
              <RichTextEditor
                value={newMinutes.decisions}
                onChange={(html) => setNewMinutes({ ...newMinutes, decisions: html })}
                placeholder="Record decisions made during the meeting…"
                minHeight={160}
                disabled={submitting}
              />
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            p: isMobile ? 2 : 3,
            borderTop: `1px solid ${dark ? '#374151' : '#E5E7EB'}`,
            flexDirection: isMobile ? 'column-reverse' : 'row',
            gap: isMobile ? 1 : 0,
          }}
        >
          <Button
            onClick={() => setShowAddDialog(false)}
            disabled={submitting}
            fullWidth={isMobile}
            sx={{ color: dark ? '#9CA3AF' : '#6B7280' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddMinutes}
            disabled={submitting || !newMinutes.topic.trim()}
            fullWidth={isMobile}
            sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
          >
            {submitting ? 'Saving…' : 'Save Minutes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Preview Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => !submitting && setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: { bgcolor: dark ? '#1F2937' : '#FFF', borderRadius: isMobile ? 0 : 2, backgroundImage: 'none' },
        }}
      >
        <DialogTitle sx={{ borderBottom: `1px solid ${dark ? '#374151' : '#E5E7EB'}`, p: isMobile ? 2 : 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ color: dark ? '#FFF' : '#111827' }}>
                Import Minutes from Document
              </Typography>
              {parsedData?.meetingInfo?.subject && (
                <Typography variant="caption" sx={{ color: dark ? '#9CA3AF' : '#6B7280' }}>
                  Detected subject: {parsedData.meetingInfo.subject}
                </Typography>
              )}
            </Box>
            <IconButton
              onClick={() => !submitting && setUploadDialogOpen(false)}
              size="small"
              sx={{ color: dark ? '#9CA3AF' : '#6B7280' }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>

          {importProgress && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: dark ? '#9CA3AF' : '#6B7280' }}>
                  Importing…
                </Typography>
                <Typography variant="caption" sx={{ color: dark ? '#9CA3AF' : '#6B7280' }}>
                  {importProgress.done} / {importProgress.total}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={(importProgress.done / importProgress.total) * 100}
                sx={{ borderRadius: 4 }}
              />
            </Box>
          )}
        </DialogTitle>

        <DialogContent sx={{ p: isMobile ? 2 : 3 }}>
          {parsedEntries.length > 0 && (
            <Stack spacing={2}>
              {parsedData?.meetingInfo && Object.values(parsedData.meetingInfo).some(Boolean) && (
                <Alert
                  severity="info"
                  icon={<InfoIcon />}
                  sx={{ bgcolor: dark ? alpha('#3B82F6', 0.1) : undefined }}
                >
                  <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ gap: 1 }}>
                    {parsedData.meetingInfo.date && <span>📅 {parsedData.meetingInfo.date}</span>}
                    {parsedData.meetingInfo.time && <span>🕐 {parsedData.meetingInfo.time}</span>}
                    {parsedData.meetingInfo.location && <span>📍 {parsedData.meetingInfo.location}</span>}
                    {parsedData.meetingInfo.recordedBy && <span>✍️ {parsedData.meetingInfo.recordedBy}</span>}
                  </Stack>
                </Alert>
              )}

              {parsedData?.attendees?.length > 0 && (
                <Alert severity="success" sx={{ bgcolor: dark ? alpha('#10B981', 0.1) : undefined }}>
                  Found {parsedData.attendees.length} attendee{parsedData.attendees.length > 1 ? 's' : ''} in the document (not imported — manage via Participants tab).
                </Alert>
              )}

              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedEntryIds.size === parsedEntries.length && parsedEntries.length > 0}
                      indeterminate={selectedEntryIds.size > 0 && selectedEntryIds.size < parsedEntries.length}
                      onChange={handleSelectAll}
                      size="small"
                      sx={{ color: dark ? '#6B7280' : undefined }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ color: dark ? '#D1D5DB' : '#374151' }}>
                      Select all ({parsedEntries.length} minutes found)
                    </Typography>
                  }
                />
                <Chip
                  label={`${selectedEntryIds.size} selected`}
                  size="small"
                  sx={{
                    bgcolor: dark ? alpha('#A78BFA', 0.15) : alpha('#7C3AED', 0.1),
                    color: dark ? '#A78BFA' : '#7C3AED',
                    fontWeight: 600,
                  }}
                />
              </Stack>

              <Typography variant="caption" sx={{ color: dark ? '#6B7280' : '#9CA3AF' }}>
                Click ▼ on any row to preview / edit its content before importing.
              </Typography>

              <Box>
                {parsedEntries.map((entry) => (
                  <ParsedMinuteRow
                    key={entry.id}
                    entry={entry}
                    selected={selectedEntryIds.has(entry.id)}
                    onToggle={handleToggleEntry}
                    onFieldChange={handleEntryFieldChange}
                    dark={dark}
                  />
                ))}
              </Box>

              {parsedData?.resolutions?.length > 0 && (
                <Box>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{ color: dark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}
                  >
                    Resolutions detected ({parsedData.resolutions.length})
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {parsedData.resolutions.map((r, i) => (
                      <Typography
                        key={i}
                        variant="caption"
                        sx={{
                          display: 'block',
                          p: '4px 10px',
                          borderRadius: 1,
                          bgcolor: dark ? alpha('#A78BFA', 0.08) : '#F5F3FF',
                          color: dark ? '#C4B5FD' : '#5B21B6',
                        }}
                      >
                        {i + 1}. {r}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            p: isMobile ? 2 : 3,
            borderTop: `1px solid ${dark ? '#374151' : '#E5E7EB'}`,
            flexDirection: isMobile ? 'column-reverse' : 'row',
            gap: isMobile ? 1 : 0,
          }}
        >
          <Button
            onClick={() => setUploadDialogOpen(false)}
            disabled={submitting}
            fullWidth={isMobile}
            sx={{ color: dark ? '#9CA3AF' : '#6B7280' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleImportMinutes}
            disabled={submitting || selectedEntryIds.size === 0}
            fullWidth={isMobile}
            startIcon={submitting ? <CircularProgress size={18} /> : <SaveIcon />}
            sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
          >
            {submitting
              ? `Importing ${importProgress?.done ?? 0}/${importProgress?.total ?? selectedEntryIds.size}…`
              : `Import ${selectedEntryIds.size} Minute${selectedEntryIds.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sub-dialogs */}
      {showAddActionDialog && (
        <AddActionDialog
          open={showAddActionDialog}
          onClose={() => setShowAddActionDialog(false)}
          meetingId={meetingId}
          minutes={minutesList}
          selectedMinuteId={selectedMinuteId}
          onSave={async (payload) => {
            try {
              const response = await api.post(
                `/action-tracker/minutes/${payload.minute_id}/actions`,
                {
                  description: payload.description,
                  due_date: payload.due_date,
                  priority: payload.priority,
                  remarks: payload.remarks,
                  assigned_to_id: payload.assigned_to_id,
                  assigned_to_name: payload.assigned_to_name,
                }
              );
              handleActionCreated();
              return response.data;
            } catch (err) {
              console.error('Error creating action:', err);
              throw err;
            }
          }}
          loading={submitting}
          error={error}
        />
      )}

      {showEditActionDialog && selectedAction && (
        <EditActionDialog
          open={showEditActionDialog}
          action={selectedAction}
          onClose={() => setShowEditActionDialog(false)}
          onSave={handleActionUpdated}
          meetingId={meetingId}
        />
      )}

      {showEditMinuteDialog && selectedMinute && (
        <EditMinuteDialog
          open={showEditMinuteDialog}
          minute={selectedMinute}
          onClose={() => setShowEditMinuteDialog(false)}
          onSave={handleMinuteUpdated}
        />
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { bgcolor: dark ? '#1F2937' : '#FFF', border: dark ? '1px solid #374151' : 'none' },
        }}
      >
        {canCreateActionsWithStatus && (
          <MenuItem
            onClick={() => { handleMenuClose(); if (selectedMinute) handleAddAction(selectedMinute.id); }}
            sx={{ color: dark ? '#D1D5DB' : 'inherit' }}
          >
            <AssignmentIcon fontSize="small" sx={{ mr: 1, color: dark ? '#A78BFA' : 'primary.main' }} />
            Add Action Item
          </MenuItem>
        )}
        {canDeleteMinutesWithStatus && (
          <MenuItem onClick={handleDeleteMinutes} sx={{ color: dark ? '#F87171' : 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete Minutes
          </MenuItem>
        )}
      </Menu>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingMinutes;