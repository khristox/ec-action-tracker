import React from 'react';
import { ListItem, ListItemAvatar, Avatar, ListItemText, Typography, Box, Chip, LinearProgress } from '@mui/material';
import { CheckCircle as CheckCircleIcon, PendingActions as PendingActionsIcon } from '@mui/icons-material';

const ActionItem = ({ action }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'overdue': return 'error';
      default: return 'warning';
    }
  };

  const getStatusIcon = (status) => {
    return status === 'completed' ? <CheckCircleIcon /> : <PendingActionsIcon />;
  };

  return (
    <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.5 }}>
      <ListItemAvatar>
        <Avatar sx={{ 
          bgcolor: `${getStatusColor(action.status)}.light`, 
          color: `${getStatusColor(action.status)}.main`, 
          width: 40, 
          height: 40 
        }}>
          {getStatusIcon(action.status)}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" fontWeight="700">{action.title}</Typography>
            <Chip 
              label={action.status?.replace('_', ' ').toUpperCase()} 
              size="small" 
              color={getStatusColor(action.status)} 
              sx={{ fontSize: '0.65rem', height: 20 }} 
            />
          </Box>
        }
        secondary={
          <Box component="span">
            <Typography variant="caption" color="text.secondary" display="block">
              Assigned to: {action.assigned_to_name || action.assigned_to} • Due: {action.due_date ? new Date(action.due_date).toLocaleDateString() : 'Not set'}
            </Typography>
            {action.overall_progress_percentage > 0 && (
              <Box sx={{ mt: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={action.overall_progress_percentage} 
                  sx={{ height: 6, borderRadius: 3 }} 
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {action.overall_progress_percentage}% complete
                </Typography>
              </Box>
            )}
          </Box>
        }
      />
    </ListItem>
  );
};

export default ActionItem;