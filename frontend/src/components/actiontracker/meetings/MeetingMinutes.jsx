// src/components/actiontracker/meetings/MeetingMinutes.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
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
  Card,
  CardContent,
  Grid,
  Fade,
  Grow,
  Zoom,
  Badge,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Fab,
  useScrollTrigger
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
  Download as DownloadIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
  SortByAlpha as SortIcon,
  Visibility as VisibilityIcon,
  DoneAll as DoneAllIcon,
  Person as PersonIcon,
  DateRange as DateRangeIcon,
  Comment as CommentIcon,
  PlaylistAddCheck as PlaylistAddCheckIcon
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
  selectMinutesError
} from '../../../store/slices/actionTracker/meetingSlice';
import AddActionDialog from './components/AddActionDialog';
import EditActionDialog from './components/EditActionDialog';
import EditMinuteDialog from './components/EditMinuteDialog';
import RichTextEditor from './components/RichTextEditor';

// ==================== Helper Functions ====================

const formatDate = (dateString) => {
  if (!dateString) return 'Date not set';
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return `Today at ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, yyyy • h:mm a');
};

const getStatusConfig = (action) => {
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const isCompleted = action.completed_at || action.overall_progress_percentage >= 100;
  
  if (isCompleted) return { label: 'Completed', color: 'success', icon: <CheckCircleIcon fontSize="small" /> };
  if (isOverdue) return { label: 'Overdue', color: 'error', icon: <WarningIcon fontSize="small" /> };
  if (action.overall_status_name === 'in_progress') return { label: 'In Progress', color: 'info', icon: <PendingIcon fontSize="small" /> };
  return { label: 'Pending', color: 'warning', icon: <ScheduleIcon fontSize="small" /> };
};

const canEditMinutes = (meetingStatus) => {
  if (!meetingStatus) return false;
  const statusLower = String(meetingStatus).toLowerCase();
  const allowedStatuses = ['started', 'ongoing', 'in_progress', 'in progress', 'completed'];
  return allowedStatuses.some(status => statusLower.includes(status));
};

// ==================== Dark Mode Rich Text Display ====================
const RichTextContent = ({ content }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  if (!content || content.trim() === '' || content === '<p></p>') {
    return (
      <Typography variant="body2" sx={{ 
        fontStyle: 'italic',
        color: isDarkMode ? '#9CA3AF' : 'text.secondary'
      }}>
        No content provided.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        textAlign: 'left',
        lineHeight: 1.7,
        color: isDarkMode ? '#E5E7EB' : 'text.primary',
        '& p': {
          margin: '0 0 12px 0',
          '&:last-child': { marginBottom: 0 },
          color: isDarkMode ? '#D1D5DB' : 'inherit'
        },
        '& ul, & ol': {
          paddingLeft: '24px',
          margin: '8px 0 16px 0',
          color: isDarkMode ? '#D1D5DB' : 'inherit'
        },
        '& li': {
          marginBottom: '6px',
          color: isDarkMode ? '#D1D5DB' : 'inherit'
        },
        '& h1, & h2, & h3': {
          margin: '16px 0 8px 0',
          fontWeight: 600,
          color: isDarkMode ? '#FFFFFF' : 'inherit'
        },
        '& blockquote': {
          margin: '16px 0',
          paddingLeft: '16px',
          borderLeft: '4px solid',
          borderColor: isDarkMode ? '#A78BFA' : 'primary.main',
          color: isDarkMode ? '#9CA3AF' : 'text.secondary',
          fontStyle: 'italic',
          backgroundColor: isDarkMode ? alpha('#A78BFA', 0.05) : 'transparent'
        },
        '& pre': {
          backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.05) : '#F8FAFC',
          padding: '12px',
          borderRadius: 1,
          overflowX: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          border: `1px solid ${isDarkMode ? '#374151' : '#E2E8F0'}`,
          color: isDarkMode ? '#E5E7EB' : 'inherit'
        },
        '& code': {
          backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.05) : '#F1F5F9',
          padding: '2px 6px',
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          color: isDarkMode ? '#A78BFA' : '#7C3AED'
        },
        '& img': {
          maxWidth: '100%',
          height: 'auto',
          borderRadius: 1,
          margin: '12px 0'
        },
        '& hr': {
          margin: '20px 0',
          border: 'none',
          borderTop: `1px solid ${isDarkMode ? '#374151' : '#E2E8F0'}`
        },
        '& a': {
          color: isDarkMode ? '#A78BFA' : '#7C3AED',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline'
          }
        },
        '& strong, & b': {
          color: isDarkMode ? '#FFFFFF' : 'inherit',
          fontWeight: 700
        }
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

// ==================== Action Row Component ====================
const ActionRow = ({ action, onEdit, canEdit }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isOverdue = action.due_date && new Date(action.due_date) < new Date() && !action.completed_at;
  const statusConfig = getStatusConfig(action);
  
  let assignedToName = 'Unassigned';
  if (action.assigned_to?.full_name) assignedToName = action.assigned_to.full_name;
  else if (action.assigned_to?.username) assignedToName = action.assigned_to.username;
  else if (typeof action.assigned_to_name === 'string') assignedToName = action.assigned_to_name;
  else if (action.assigned_to_name?.name) assignedToName = action.assigned_to_name.name;

  const progress = action.overall_progress_percentage || 0;

  return (
    <TableRow hover sx={{ '&:hover': { bgcolor: isDarkMode ? alpha('#FFFFFF', 0.05) : alpha('#000000', 0.02) } }}>
      <TableCell sx={{ pl: 2 }}>
        <Typography variant="body2" fontWeight={500} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
          {action.description}
        </Typography>
        {action.remarks && (
          <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
            {action.remarks}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Avatar sx={{ 
            width: 28, 
            height: 28, 
            bgcolor: isDarkMode ? alpha('#A78BFA', 0.2) : 'primary.light',
            fontSize: '0.75rem',
            color: isDarkMode ? '#A78BFA' : 'primary.main'
          }}>
            {assignedToName?.[0]?.toUpperCase() || '?'}
          </Avatar>
          <Typography variant="body2" sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}>
            {assignedToName}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AccessTimeIcon fontSize="small" sx={{ color: isOverdue ? (isDarkMode ? '#F87171' : 'error') : (isDarkMode ? '#6B7280' : 'action') }} />
          <Typography variant="body2" sx={{ color: isOverdue ? (isDarkMode ? '#F87171' : 'error') : (isDarkMode ? '#D1D5DB' : 'inherit') }}>
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
          sx={{ 
            height: 26, 
            fontWeight: 500,
            ...(isDarkMode && statusConfig.color === 'warning' && {
              bgcolor: alpha('#F59E0B', 0.2),
              color: '#FBBF24'
            }),
            ...(isDarkMode && statusConfig.color === 'info' && {
              bgcolor: alpha('#3B82F6', 0.2),
              color: '#60A5FA'
            })
          }}
        />
      </TableCell>
      <TableCell sx={{ minWidth: 120 }}>
        <Stack spacing={0.5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" fontWeight={500} sx={{ color: isDarkMode ? '#9CA3AF' : 'inherit' }}>
              {progress}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 6, 
              borderRadius: 3,
              bgcolor: isDarkMode ? '#374151' : '#E2E8F0',
              '& .MuiLinearProgress-bar': {
                bgcolor: statusConfig.label === 'Completed' ? '#10B981' : (isOverdue ? '#EF4444' : (isDarkMode ? '#A78BFA' : '#3B82F6'))
              }
            }} 
          />
        </Stack>
      </TableCell>
      <TableCell align="center">
        <Tooltip title={canEdit ? "Edit Action" : "Meeting must be started to edit actions"}>
          <span>
            <IconButton 
              size="small" 
              onClick={() => onEdit(action.id)} 
              disabled={!canEdit}
              sx={{
                color: isDarkMode ? '#A78BFA' : 'primary.main',
                '&:hover': {
                  backgroundColor: isDarkMode ? alpha('#A78BFA', 0.1) : alpha('#7C3AED', 0.1)
                }
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

// ==================== Minutes Card Component ====================
const MinutesCard = ({ minute, expanded, onToggle, onAddAction, onEditAction, onEditMinute, onMenuOpen, canEdit }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const minuteId = minute.id;
  const title = minute.topic || minute.title || 'Untitled Minutes';
  const discussion = minute.discussion || minute.content || '';
  const decisions = minute.decisions || '';
  const timestamp = minute.timestamp || minute.created_at;
  const actionCount = minute.actions?.length || 0;
  const completedActions = minute.actions?.filter(a => a.completed_at || a.overall_progress_percentage >= 100).length || 0;
  const recordedByName = minute.recorded_by_name || minute.created_by_name;

  return (
    <Zoom in timeout={300}>
      <Accordion
        expanded={expanded}
        onChange={onToggle}
        sx={{
          borderRadius: 2,
          '&:before': { display: 'none' },
          boxShadow: expanded ? 3 : 1,
          bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: 4
          }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#9CA3AF' : 'inherit' }} />}
          sx={{ 
            '&:hover': { bgcolor: isDarkMode ? alpha('#FFFFFF', 0.05) : alpha('#000000', 0.02) },
            borderRadius: expanded ? '8px 8px 0 0' : '8px'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
            <Avatar sx={{ 
              bgcolor: isDarkMode ? alpha('#A78BFA', 0.2) : 'primary.main',
              color: isDarkMode ? '#A78BFA' : '#FFFFFF',
              width: 40, 
              height: 40 
            }}>
              <DescriptionIcon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                {title}
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                  {formatDate(timestamp)}
                </Typography>
                {recordedByName && (
                  <Typography variant="caption" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                    Recorded by: {recordedByName}
                  </Typography>
                )}
                <Badge 
                  badgeContent={actionCount} 
                  color="primary"
                  sx={{ '& .MuiBadge-badge': { bgcolor: isDarkMode ? '#A78BFA' : undefined } }}
                >
                  <AssignmentIcon fontSize="small" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }} />
                </Badge>
              </Stack>
            </Box>
            {canEdit && (
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Edit Minutes">
                  <IconButton 
                    size="small" 
                    onClick={(e) => { e.stopPropagation(); onEditMinute(minute); }}
                    sx={{ color: isDarkMode ? '#A78BFA' : 'primary.main' }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <IconButton 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); onMenuOpen(e, minute); }}
                  sx={{ color: isDarkMode ? '#9CA3AF' : 'inherit' }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Stack>
            )}
          </Stack>
        </AccordionSummary>
        
        <AccordionDetails sx={{ pt: 0 }}>
          <Divider sx={{ mb: 3, borderColor: isDarkMode ? '#374151' : '#E5E7EB' }} />
          <Stack spacing={4}>
            {/* Discussion */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <NotesIcon fontSize="small" sx={{ color: isDarkMode ? '#A78BFA' : 'primary.main' }} />
                <Typography variant="subtitle2" fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                  Discussion
                </Typography>
              </Stack>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 3, 
                  bgcolor: isDarkMode ? alpha('#FFFFFF', 0.03) : '#F8FAFC', 
                  borderRadius: 2,
                  borderColor: isDarkMode ? '#374151' : '#E5E7EB'
                }}
              >
                <RichTextContent content={discussion} />
              </Paper>
            </Box>

            {/* Decisions */}
            {decisions && decisions !== '<p></p>' && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <AssignmentIcon fontSize="small" sx={{ color: isDarkMode ? '#34D399' : 'success.main' }} />
                  <Typography variant="subtitle2" fontWeight={600} sx={{ color: isDarkMode ? '#34D399' : 'success.main' }}>
                    Decisions
                  </Typography>
                </Stack>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 3, 
                    bgcolor: isDarkMode ? alpha('#34D399', 0.05) : '#F0FDF4', 
                    borderRadius: 2,
                    borderColor: isDarkMode ? alpha('#34D399', 0.2) : '#E5E7EB'
                  }}
                >
                  <RichTextContent content={decisions} />
                </Paper>
              </Box>
            )}

            {/* Actions Section */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PlaylistAddCheckIcon fontSize="small" sx={{ color: isDarkMode ? '#A78BFA' : 'primary.main' }} />
                  <Typography variant="subtitle2" fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
                    Action Items
                  </Typography>
                  {actionCount > 0 && (
                    <Chip 
                      label={`${completedActions}/${actionCount} completed`} 
                      size="small" 
                      color="success" 
                      variant="outlined"
                      sx={{
                        borderColor: isDarkMode ? '#34D399' : undefined,
                        color: isDarkMode ? '#34D399' : undefined
                      }}
                    />
                  )}
                </Stack>
                {canEdit && (
                  <Button 
                    size="small" 
                    variant="contained" 
                    startIcon={<AddIcon />} 
                    onClick={() => onAddAction(minuteId)}
                    sx={{
                      bgcolor: isDarkMode ? '#7C3AED' : '#7C3AED',
                      '&:hover': { bgcolor: isDarkMode ? '#6D28D9' : '#6D28D9' }
                    }}
                  >
                    Add Action
                  </Button>
                )}
              </Stack>

              {actionCount > 0 ? (
                <TableContainer 
                  component={Paper} 
                  variant="outlined" 
                  sx={{ 
                    borderRadius: 2,
                    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                    bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF'
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: isDarkMode ? alpha('#A78BFA', 0.1) : '#F1F5F9' }}>
                        <TableCell sx={{ fontWeight: 700, pl: 2, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Assigned To</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Due Date</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }}>Progress</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#FFFFFF' : 'inherit' }} align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {minute.actions.map((action) => (
                        <ActionRow key={action.id} action={action} onEdit={onEditAction} canEdit={canEdit} />
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
                    bgcolor: isDarkMode ? alpha('#FFFFFF', 0.03) : '#FAFAFA',
                    borderColor: isDarkMode ? '#374151' : '#E5E7EB'
                  }}
                >
                  <AssignmentIcon sx={{ fontSize: 48, color: isDarkMode ? '#6B7280' : '#CBD5E1', mb: 2 }} />
                  <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
                    No action items yet.
                  </Typography>
                  {canEdit && (
                    <Button 
                      size="small" 
                      startIcon={<AddIcon />} 
                      onClick={() => onAddAction(minuteId)} 
                      sx={{ mt: 2, color: isDarkMode ? '#A78BFA' : 'primary.main' }}
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
  const isDarkMode = theme.palette.mode === 'dark';
  
  return (
    <Stack spacing={2}>
      {[1, 2, 3].map((i) => (
        <Paper key={i} sx={{ p: 2, borderRadius: 2, bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: isDarkMode ? '#374151' : undefined }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={24} sx={{ bgcolor: isDarkMode ? '#374151' : undefined }} />
              <Skeleton variant="text" width="30%" height={20} sx={{ bgcolor: isDarkMode ? '#374151' : undefined }} />
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
};

// ==================== Empty State Component ====================
const EmptyState = ({ canEdit, statusMessage, onAddClick }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  return (
    <Grow in timeout={500}>
      <Paper sx={{ 
        p: 8, 
        textAlign: 'center', 
        borderRadius: 3,
        bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
        border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`
      }}>
        <AutoAwesomeIcon sx={{ fontSize: 80, color: isDarkMode ? '#6B7280' : '#CBD5E1', mb: 2 }} />
        <Typography variant="h6" sx={{ color: isDarkMode ? '#FFFFFF' : 'text.secondary' }} gutterBottom>
          No Minutes Yet
        </Typography>
        <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary', mb: 3 }}>
          {canEdit 
            ? "Start by adding the first meeting minutes" 
            : statusMessage || "Minutes can only be added once the meeting is in progress"}
        </Typography>
        {canEdit && (
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={onAddClick}
            size="large"
            sx={{
              bgcolor: isDarkMode ? '#7C3AED' : '#7C3AED',
              '&:hover': { bgcolor: isDarkMode ? '#6D28D9' : '#6D28D9' }
            }}
          >
            Add First Minutes
          </Button>
        )}
      </Paper>
    </Grow>
  );
};

// ==================== Main Component ====================
const MeetingMinutes = ({ meetingId, meetingStatus, onRefresh }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';
  
  const minutesList = useSelector(selectMeetingMinutes);
  const isLoading = useSelector(selectMinutesLoading);
  const error = useSelector(selectMinutesError);
  
  const [expandedMinute, setExpandedMinute] = useState(null);
  const [showAddMinutesDialog, setShowAddMinutesDialog] = useState(false);
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
  const [filterStatus, setFilterStatus] = useState('all');

  const canEdit = canEditMinutes(meetingStatus);
  
  const getStatusMessage = () => {
    if (!meetingStatus) return null;
    const statusLower = String(meetingStatus).toLowerCase();
    if (statusLower === 'scheduled' || statusLower === 'pending') {
      return "Meeting hasn't started yet. Minutes can only be added once the meeting is in progress.";
    }
    if (statusLower === 'cancelled') {
      return "Meeting has been cancelled. Minutes cannot be added or edited.";
    }
    return null;
  };

  const fetchMinutes = useCallback(() => {
    if (meetingId) dispatch(fetchMeetingMinutes(meetingId));
  }, [dispatch, meetingId]);

  useEffect(() => {
    if (meetingId) fetchMinutes();
  }, [meetingId, fetchMinutes]);

  const handleRefresh = () => {
    fetchMinutes();
    if (onRefresh) onRefresh();
  };

  const handleAddMinutes = async () => {
    if (!newMinutes.topic.trim()) {
      setSnackbar({ open: true, message: 'Please enter a topic', severity: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await dispatch(createMeetingMinutes({ meetingId, data: newMinutes })).unwrap();
      setShowAddMinutesDialog(false);
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

  const handleAddAction = (minuteId) => {
    setSelectedMinuteId(minuteId);
    setShowAddActionDialog(true);
  };

  const handleEditAction = (actionId) => {
    let action = null;
    for (const minute of minutesList) {
      action = minute.actions?.find(a => a.id === actionId);
      if (action) break;
    }
    setSelectedAction(action);
    setShowEditActionDialog(true);
  };

  const handleEditMinute = (minute) => {
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

  const handleMenuOpen = (event, minute) => {
    setAnchorEl(event.currentTarget);
    setSelectedMinute(minute);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMinute(null);
  };

  const handleDeleteMinutes = async () => {
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
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to delete minutes', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleMinute = (minuteId) => {
    setExpandedMinute(expandedMinute === minuteId ? null : minuteId);
  };

  // Filter minutes based on search term
  const filteredMinutes = minutesList.filter(minute => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return minute.topic?.toLowerCase().includes(searchLower) ||
           minute.discussion?.toLowerCase().includes(searchLower) ||
           minute.decisions?.toLowerCase().includes(searchLower);
  });

  const statusMessage = getStatusMessage();

  if (isLoading && minutesList.length === 0) return <LoadingSkeleton />;

  return (
    <Box>
      {/* Header with Actions */}
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ color: isDarkMode ? '#FFFFFF' : 'inherit' }}>
          Meeting Minutes ({filteredMinutes.length})
        </Typography>
        
        <Stack direction="row" spacing={1}>
          {/* Search Field */}
          <TextField
            size="small"
            placeholder="Search minutes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ 
              width: isMobile ? '100%' : 200,
              '& .MuiOutlinedInput-root': {
                color: isDarkMode ? '#D1D5DB' : 'inherit',
                '& fieldset': {
                  borderColor: isDarkMode ? '#4B5563' : '#E5E7EB'
                },
                '&:hover fieldset': {
                  borderColor: isDarkMode ? '#6B7280' : '#D1D5DB'
                }
              }
            }}
            InputProps={{
              startAdornment: (
                <SearchIcon fontSize="small" sx={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', mr: 1 }} />
              )
            }}
          />
          
          <Tooltip title="Refresh">
            <IconButton 
              onClick={handleRefresh} 
              disabled={isLoading}
              sx={{
                color: isDarkMode ? '#D1D5DB' : 'inherit',
                '&:hover': {
                  backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04)
                }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title={!canEdit ? (statusMessage || "Meeting must be started to add minutes") : "Add meeting minutes"}>
            <span>
              <Button 
                variant="contained" 
                startIcon={!canEdit ? <LockIcon /> : <AddIcon />} 
                onClick={() => setShowAddMinutesDialog(true)}
                disabled={!canEdit}
                sx={{
                  bgcolor: isDarkMode ? '#7C3AED' : '#7C3AED',
                  '&:hover': { bgcolor: isDarkMode ? '#6D28D9' : '#6D28D9' },
                  '&.Mui-disabled': {
                    bgcolor: isDarkMode ? '#374151' : '#E5E7EB',
                    color: isDarkMode ? '#6B7280' : '#9CA3AF'
                  }
                }}
              >
                Add Minutes
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Status message when meeting hasn't started */}
      {statusMessage && (
        <Alert 
          severity="info" 
          icon={<LockIcon />} 
          sx={{ 
            mb: 2, 
            borderRadius: 2,
            bgcolor: isDarkMode ? alpha('#3B82F6', 0.1) : undefined,
            color: isDarkMode ? '#60A5FA' : undefined,
            '& .MuiAlert-icon': {
              color: isDarkMode ? '#60A5FA' : undefined
            }
          }}
        >
          {statusMessage}
        </Alert>
      )}

      {error && (
        <Alert 
          severity="error" 
          onClose={() => dispatch(clearMinutesError())} 
          sx={{ 
            mb: 2, 
            borderRadius: 2,
            bgcolor: isDarkMode ? '#7F1D1D' : undefined,
            color: isDarkMode ? '#FCA5A5' : undefined
          }}
        >
          {error}
        </Alert>
      )}

      {/* Minutes List or Empty State */}
      {!isLoading && filteredMinutes.length === 0 ? (
        searchTerm ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF' }}>
            <SearchIcon sx={{ fontSize: 80, color: isDarkMode ? '#6B7280' : '#CBD5E1', mb: 2 }} />
            <Typography variant="h6" sx={{ color: isDarkMode ? '#FFFFFF' : 'text.secondary' }} gutterBottom>
              No matching minutes found
            </Typography>
            <Typography variant="body2" sx={{ color: isDarkMode ? '#9CA3AF' : 'text.secondary' }}>
              Try adjusting your search terms
            </Typography>
          </Paper>
        ) : (
          <EmptyState 
            canEdit={canEdit} 
            statusMessage={statusMessage} 
            onAddClick={() => setShowAddMinutesDialog(true)} 
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
              onDelete={handleDeleteMinutes}
              canEdit={canEdit}
            />
          ))}
        </Stack>
      )}

      {/* Add Minutes Dialog */}
      <Dialog 
        open={showAddMinutesDialog} 
        onClose={() => !submitting && setShowAddMinutesDialog(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
            borderRadius: isMobile ? 0 : 2,
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
          bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
          p: isMobile ? 2 : 3
        }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant={isMobile ? "h6" : "h5"} fontWeight={600} sx={{ color: isDarkMode ? '#FFFFFF' : '#111827' }}>
              Add Meeting Minutes
            </Typography>
            {!isMobile && (
              <IconButton 
                onClick={() => !submitting && setShowAddMinutesDialog(false)} 
                size="small"
                sx={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
              >
                <CloseIcon />
              </IconButton>
            )}
          </Stack>
          {submitting && (
            <LinearProgress 
              sx={{ 
                mt: 2, 
                bgcolor: isDarkMode ? '#374151' : '#E5E7EB',
                '& .MuiLinearProgress-bar': {
                  bgcolor: isDarkMode ? '#A78BFA' : '#7C3AED'
                }
              }} 
            />
          )}
        </DialogTitle>
        
        <DialogContent sx={{ 
          p: isMobile ? 2 : 3,
          bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF'
        }}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Topic *"
              value={newMinutes.topic}
              onChange={(e) => setNewMinutes({ ...newMinutes, topic: e.target.value })}
              required
              disabled={submitting}
              helperText="Required - A descriptive title for these minutes"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: isDarkMode ? '#D1D5DB' : 'inherit',
                  '& fieldset': {
                    borderColor: isDarkMode ? '#4B5563' : '#E5E7EB'
                  },
                  '&:hover fieldset': {
                    borderColor: isDarkMode ? '#6B7280' : '#D1D5DB'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: isDarkMode ? '#A78BFA' : '#7C3AED'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: isDarkMode ? '#9CA3AF' : '#6B7280',
                  '&.Mui-focused': {
                    color: isDarkMode ? '#A78BFA' : '#7C3AED'
                  }
                },
                '& .MuiFormHelperText-root': {
                  color: isDarkMode ? '#9CA3AF' : '#6B7280'
                }
              }}
            />
            
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}>
                Discussion
              </Typography>
              <RichTextEditor
                value={newMinutes.discussion}
                onChange={(html) => setNewMinutes({ ...newMinutes, discussion: html })}
                placeholder="Record discussion points..."
                minHeight={220}
                disabled={submitting}
              />
            </Box>
            
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ color: isDarkMode ? '#D1D5DB' : '#374151' }}>
                Decisions (Optional)
              </Typography>
              <RichTextEditor
                value={newMinutes.decisions}
                onChange={(html) => setNewMinutes({ ...newMinutes, decisions: html })}
                placeholder="Record decisions made during the meeting..."
                minHeight={160}
                disabled={submitting}
              />
            </Box>
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ 
          p: isMobile ? 2 : 3, 
          borderTop: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
          bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
          flexDirection: isMobile ? 'column-reverse' : 'row',
          gap: isMobile ? 1 : 0
        }}>
          <Button 
            onClick={() => setShowAddMinutesDialog(false)} 
            disabled={submitting}
            fullWidth={isMobile}
            sx={{
              color: isDarkMode ? '#9CA3AF' : '#6B7280',
              '&:hover': {
                backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04)
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAddMinutes} 
            disabled={submitting || !newMinutes.topic.trim()}
            fullWidth={isMobile}
            sx={{
              bgcolor: isDarkMode ? '#7C3AED' : '#7C3AED',
              '&:hover': {
                bgcolor: isDarkMode ? '#6D28D9' : '#6D28D9'
              },
              '&.Mui-disabled': {
                bgcolor: isDarkMode ? '#374151' : '#E5E7EB',
                color: isDarkMode ? '#6B7280' : '#9CA3AF'
              }
            }}
          >
            {submitting ? 'Saving...' : 'Save Minutes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Action Dialog */}
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
                  assigned_to_name: payload.assigned_to_name
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

      {/* Edit Action Dialog */}
      {showEditActionDialog && selectedAction && (
        <EditActionDialog 
          open={showEditActionDialog} 
          action={selectedAction}
          onClose={() => setShowEditActionDialog(false)} 
          onSave={handleActionUpdated}
          meetingId={meetingId}
        />
      )}

      {/* Edit Minute Dialog */}
      {showEditMinuteDialog && selectedMinute && (
        <EditMinuteDialog 
          open={showEditMinuteDialog} 
          minute={selectedMinute}
          onClose={() => setShowEditMinuteDialog(false)} 
          onSave={handleMinuteUpdated}
        />
      )}

      {/* Menu for minutes actions */}
      <Menu 
        anchorEl={anchorEl} 
        open={Boolean(anchorEl)} 
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
            border: isDarkMode ? '1px solid #374151' : 'none'
          }
        }}
      >
        <MenuItem 
          onClick={() => { 
            handleMenuClose(); 
            if (selectedMinute) handleAddAction(selectedMinute.id); 
          }}
          sx={{ color: isDarkMode ? '#D1D5DB' : 'inherit' }}
        >
          <AssignmentIcon fontSize="small" sx={{ mr: 1, color: isDarkMode ? '#A78BFA' : 'primary.main' }} />
          Add Action Item
        </MenuItem>
        <MenuItem 
          onClick={handleDeleteMinutes} 
          sx={{ color: isDarkMode ? '#F87171' : 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete Minutes
        </MenuItem>
      </Menu>

      {/* Snackbar for notifications */}
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
          sx={{
            bgcolor: snackbar.severity === 'success' && isDarkMode ? '#065F46' : undefined,
            color: snackbar.severity === 'success' && isDarkMode ? '#A7F3D0' : undefined
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingMinutes;