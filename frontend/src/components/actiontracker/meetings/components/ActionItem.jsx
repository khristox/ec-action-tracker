// ActionItem.jsx - Complete working version
import React, { useState } from 'react';
import {
  Paper, CardContent, Typography, Chip, Stack, Divider,
  IconButton, Tooltip, LinearProgress, Collapse, Button,
  Box
} from '@mui/material';
import {
  Edit as EditIcon, CheckCircle as CheckCircleIcon,
  Warning as WarningIcon, PlayCircle as PlayCircleIcon, Schedule as ScheduleIcon,
  Person as PersonIcon, Comment as CommentIcon, ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon, Assignment as AssignmentIcon
} from '@mui/icons-material';

const ActionItem = ({ action, minuteId, onUpdate, onEdit, disabled }) => {
  const [expanded, setExpanded] = useState(false);

  // If action is undefined or null, show error state
  if (!action) {
    console.error('ActionItem received undefined action');
    return (
      <Paper sx={{ p: 2, bgcolor: '#ffebee', borderRadius: 2 }}>
        <Typography variant="body2" color="error">Error: Action data is missing</Typography>
      </Paper>
    );
  }

  // Helper function to safely get string value from any type
  const getStringValue = (value, defaultValue = 'N/A') => {
    if (!value) return defaultValue;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      if (value.name) return value.name;
      if (value.label) return value.label;
      if (value.value) return String(value.value);
      return defaultValue;
    }
    return defaultValue;
  };

  // Get description safely
  const description = getStringValue(action.description, action.title || 'Untitled Action');

  // Get assigned to safely
  let assignedTo = 'Unassigned';
  if (action.assigned_to_name) {
    assignedTo = getStringValue(action.assigned_to_name, 'Assigned User');
  } else if (action.assigned_to) {
    assignedTo = getStringValue(action.assigned_to, 'Assigned User');
  } else if (action.assignee) {
    assignedTo = getStringValue(action.assignee, 'Assigned User');
  }

  // Get status info
  let status = { label: 'Pending', color: '#ff9800', bgColor: '#fff3e0', icon: <AssignmentIcon fontSize="small" /> };
  const statusValue = getStringValue(action.status || action.action_status, '');
  
  if (statusValue) {
    const statusLower = statusValue.toLowerCase();
    if (statusLower === 'completed') {
      status = { label: 'Completed', color: '#4caf50', bgColor: '#e8f5e9', icon: <CheckCircleIcon fontSize="small" /> };
    } else if (statusLower === 'overdue') {
      status = { label: 'Overdue', color: '#f44336', bgColor: '#ffebee', icon: <WarningIcon fontSize="small" /> };
    } else if (statusLower === 'in-progress' || statusLower === 'in_progress' || statusLower === 'started') {
      status = { label: 'In Progress', color: '#2196f3', bgColor: '#e3f2fd', icon: <PlayCircleIcon fontSize="small" /> };
    }
  }

  // Get priority info
  let priority = { label: 'Medium', color: '#ff9800', bgColor: '#fff3e0', icon: '🟠' };
  const priorityValue = action.priority;
  
  if (priorityValue) {
    const priorityNum = parseInt(priorityValue);
    if (priorityNum === 1) priority = { label: 'High', color: '#f44336', bgColor: '#ffebee', icon: '🔴' };
    else if (priorityNum === 2) priority = { label: 'Medium', color: '#ff9800', bgColor: '#fff3e0', icon: '🟠' };
    else if (priorityNum === 3) priority = { label: 'Low', color: '#4caf50', bgColor: '#e8f5e9', icon: '🟢' };
    else if (priorityNum === 4) priority = { label: 'Very Low', color: '#9e9e9e', bgColor: '#f5f5f5', icon: '⚪' };
  }

  // Get due date safely
  let dueDateString = null;
  if (action.due_date) {
    try {
      dueDateString = new Date(action.due_date).toLocaleDateString();
    } catch (e) {
      dueDateString = null;
    }
  }
  
  const isOverdue = action.is_overdue === true || (dueDateString && new Date(action.due_date) < new Date() && status.label !== 'Completed');

  // Get progress safely
  const progress = action.overall_progress_percentage || action.progress_percentage || 0;

  // Get remarks safely
  const remarks = getStringValue(action.remarks || action.notes, '');

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        borderRadius: 2, 
        border: '1px solid',
        borderColor: isOverdue ? '#ffebee' : '#e2e8f0',
        bgcolor: isOverdue ? '#fff5f5' : 'white',
        transition: 'all 0.2s',
        '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header with Status and Priority */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
            <Chip 
              size="small" 
              label={status.label}
              icon={status.icon}
              sx={{ 
                bgcolor: status.bgColor, 
                color: status.color, 
                fontWeight: 600,
                height: 24,
                '& .MuiChip-icon': { color: status.color }
              }}
            />
            <Chip 
              size="small" 
              label={`${priority.icon} ${priority.label}`}
              sx={{ 
                bgcolor: priority.bgColor, 
                color: priority.color, 
                fontWeight: 600,
                height: 24
              }}
            />
            {isOverdue && (
              <Chip 
                size="small" 
                label="OVERDUE" 
                color="error" 
                sx={{ fontWeight: 700, height: 24 }}
              />
            )}
          </Stack>
          
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Edit Action">
              <IconButton 
                size="small" 
                onClick={() => onEdit(minuteId, action)} 
                disabled={disabled}
                sx={{ p: 0.5 }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Description */}
        <Typography 
          variant="body1" 
          fontWeight={700} 
          sx={{ mb: 1.5, lineHeight: 1.4 }}
        >
          {description}
        </Typography>

        {/* Additional Details - Using Stack */}
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <PersonIcon sx={{ fontSize: 16, color: '#64748b' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              Assigned to:
            </Typography>
            <Typography variant="caption" fontWeight={600}>
              {assignedTo}
            </Typography>
          </Stack>
          
          <Stack direction="row" spacing={1} alignItems="center">
            <ScheduleIcon sx={{ fontSize: 16, color: '#64748b' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              Due Date:
            </Typography>
            <Typography 
              variant="caption" 
              fontWeight={600}
              color={isOverdue ? 'error.main' : 'text.primary'}
            >
              {dueDateString || 'No due date'}
            </Typography>
          </Stack>
        </Stack>

        {/* Progress Section */}
        {progress > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Progress
              </Typography>
              <Typography variant="caption" fontWeight={700} color="primary.main">
                {progress}%
              </Typography>
            </Stack>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                height: 6, 
                borderRadius: 3, 
                bgcolor: '#e0e0e0',
                '& .MuiLinearProgress-bar': { 
                  bgcolor: status.color,
                  borderRadius: 3
                }
              }}
            />
          </Box>
        )}

        {/* Remarks Section */}
        {remarks && remarks !== 'N/A' && remarks !== '' && (
          <>
            <Button
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ textTransform: 'none', mt: 0.5, p: 0 }}
            >
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              {expanded ? 'Hide remarks' : 'Show remarks'}
            </Button>
            <Collapse in={expanded}>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 1.5, 
                  mt: 1, 
                  bgcolor: '#f8fafc',
                  borderRadius: 1.5
                }}
              >
                <Stack direction="row" spacing={1}>
                  <CommentIcon sx={{ fontSize: 16, color: '#64748b' }} />
                  <Typography variant="body2" color="text.secondary">
                    {remarks}
                  </Typography>
                </Stack>
              </Paper>
            </Collapse>
          </>
        )}

        {/* Metadata Footer */}
        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="text.disabled">
            ID: {typeof action.id === 'string' ? action.id.slice(0, 8) : 'Unknown'}
          </Typography>
          {action.completed_at && (
            <Chip 
              size="small" 
              label={`Completed: ${new Date(action.completed_at).toLocaleDateString()}`}
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          )}
        </Stack>
      </CardContent>
    </Paper>
  );
};

export default ActionItem;