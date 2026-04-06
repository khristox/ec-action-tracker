import React, { useState } from 'react';
import { 
  List, ListItem, ListItemAvatar, Avatar, ListItemText, 
  Typography, Stack, Chip, IconButton, Tooltip, Box,
  CircularProgress, Badge
} from '@mui/material';
import { 
  CheckCircle as ConfirmIcon, 
  Cancel as MissedIcon,
  Star as StarIcon 
} from '@mui/icons-material';
import api from '../../../../services/api';

const ParticipantList = ({ participants, meetingId, isStarted, onUpdate }) => {
  const [processingId, setProcessingId] = useState(null);

  const handleAttendance = async (participantId, status) => {
    setProcessingId(participantId);
    try {
      await api.patch(`/action-tracker/meetings/${meetingId}/participants/${participantId}`, { 
        attendance_status: status 
      });
      onUpdate();
    } catch (err) { 
      console.error("Attendance update failed:", err); 
    } finally {
      setProcessingId(null);
    }
  };

  const renderAuditTrail = (p) => {
    const isUpdated = Boolean(p.updated_at);
    const dateStr = new Date(isUpdated ? p.updated_at : p.created_at).toLocaleString();
    const actor = isUpdated ? (p.updated_by_name || 'System') : (p.created_by_name || 'System');
    
    return (
      <Typography variant="caption" color="text.secondary" component="span">
        {isUpdated ? 'Updated by: ' : 'Added by: '}
        <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{actor}</Box>
        {` (${dateStr})`}
      </Typography>
    );
  };

  return (
    <List sx={{ width: '100%', py: 0 }}>
      {participants?.map((p) => (
        <ListItem 
          key={p.id} 
          sx={{ 
            bgcolor: '#f8fafc', 
            mb: 1.5, 
            borderRadius: 2, 
            border: '1px solid #e2e8f0',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: '#f1f5f9', borderColor: '#cbd5e1' }
          }}
        >
          <ListItemAvatar>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={p.is_chairperson ? <StarIcon sx={{ fontSize: 14, color: '#f59e0b' }} /> : null}
            >
              <Avatar 
                sx={{ 
                  bgcolor: p.is_chairperson ? 'primary.main' : 'secondary.light',
                  color: p.is_chairperson ? 'primary.contrastText' : 'secondary.main',
                  fontWeight: 'bold'
                }}
              >
                {p.name?.charAt(0).toUpperCase()}
              </Avatar>
            </Badge>
          </ListItemAvatar>

          <ListItemText 
            primary={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle1" fontWeight={600}>{p.name}</Typography>
                {p.is_chairperson && <Chip label="Chairperson" size="small" color="primary" variant="soft" sx={{ height: 20, fontSize: '0.65rem' }} />}
              </Stack>
            } 
            secondary={
              <Stack component="span" spacing={0.2}>
                <Typography variant="caption" display="block" color="primary.main" sx={{ fontWeight: 500 }}>
                  {p.email}
                </Typography>
                {renderAuditTrail(p)}
              </Stack>
            }
          />

          <Stack direction="row" spacing={1} alignItems="center">
            {p.attendance_status && (
              <Chip 
                label={p.attendance_status.toUpperCase()} 
                size="small" 
                color={p.attendance_status === 'attended' ? 'success' : 'error'} 
                variant="filled"
                sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
              />
            )}
            
            {isStarted && (
              <Box sx={{ position: 'relative', display: 'flex' }}>
                <Tooltip title="Mark Attended">
                  <IconButton 
                    color="success" 
                    onClick={() => handleAttendance(p.id, 'attended')} 
                    size="small"
                    disabled={processingId === p.id}
                  >
                    <ConfirmIcon />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Mark Missed">
                  <IconButton 
                    color="error" 
                    onClick={() => handleAttendance(p.id, 'missed')} 
                    size="small"
                    disabled={processingId === p.id}
                  >
                    <MissedIcon />
                  </IconButton>
                </Tooltip>
                
                {processingId === p.id && (
                  <CircularProgress
                    size={24}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      marginTop: '-12px',
                      marginLeft: '-12px',
                    }}
                  />
                )}
              </Box>
            )}
          </Stack>
        </ListItem>
      ))}
      
      {(!participants || participants.length === 0) && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No participants registered for this meeting.
        </Typography>
      )}
    </List>
  );
};

export default ParticipantList;