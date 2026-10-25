import React, { useState } from 'react';
import { 
  List, ListItem, ListItemAvatar, Avatar, ListItemText, 
  Typography, Stack, Chip, IconButton, Tooltip, Box,
  CircularProgress, Badge, useTheme, alpha, Fade, Grow,
  Paper, Collapse, Divider
} from '@mui/material';
import { 
  CheckCircle as ConfirmIcon, 
  Cancel as MissedIcon,
  Star as StarIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  AccessTime as AccessTimeIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import api from '../../../../services/api';

const ParticipantList = ({ participants, meetingId, isStarted, onUpdate }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [processingId, setProcessingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

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

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getAttendanceStyle = (status) => {
    const colors = {
      attended: theme.palette.success,
      missed: theme.palette.error,
      excused: theme.palette.warning,
      default: theme.palette.text
    };
    const colorObj = colors[status] || colors.default;
    return {
      main: colorObj.main,
      bg: alpha(colorObj.main, isDark ? 0.15 : 0.08),
      border: alpha(colorObj.main, 0.3)
    };
  };

  const renderAuditTrail = (p) => {
    const isUpdated = Boolean(p.updated_at);
    const dateStr = new Date(isUpdated ? p.updated_at : p.created_at).toLocaleString();
    const actor = isUpdated ? (p.updated_by_name || 'System') : (p.created_by_name || 'System');
    
    return (
      <Stack 
        direction="row" 
        alignItems="center" 
        spacing={1} 
        sx={{ 
          mt: 2, 
          pt: 1.5, 
          borderTop: `1px dashed ${theme.palette.divider}` 
        }}
      >
        <HistoryIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        <Typography variant="caption" color="text.secondary">
          {isUpdated ? 'Updated by' : 'Added by'}:
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', ml: 0.5 }}>
            {actor}
          </Box>
          <Box component="span" sx={{ mx: 0.5, color: 'text.disabled' }}>•</Box>
          <AccessTimeIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
          {dateStr}
        </Typography>
      </Stack>
    );
  };

  if (!participants || participants.length === 0) {
    return (
      <Fade in>
        <Paper 
          elevation={0}
          sx={{ 
            p: 8, 
            textAlign: 'center',
            borderRadius: 4,
            bgcolor: alpha(theme.palette.background.paper, 0.4),
            border: `1px dashed ${theme.palette.divider}`,
            backdropFilter: 'blur(8px)'
          }}
        >
          <PeopleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2, opacity: 0.3 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
            Empty Participant List
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 300, mx: 'auto' }}>
            {isStarted 
              ? "No participants have been added to this meeting session yet."
              : "Participant management will be available once the meeting starts."}
          </Typography>
        </Paper>
      </Fade>
    );
  }

  return (
    <List sx={{ width: '100%', py: 0 }}>
      {participants.map((p, index) => {
        const attStyle = getAttendanceStyle(p.attendance_status);
        const isExpanded = expandedId === p.id;
        const isUpdating = processingId === p.id;

        return (
          <Grow in timeout={200 * (index + 1)} key={p.id}>
            <Paper
              elevation={0}
              sx={{ 
                mb: 2,
                borderRadius: 3,
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid',
                borderColor: isExpanded 
                  ? alpha(theme.palette.primary.main, 0.5) 
                  : alpha(theme.palette.divider, isDark ? 0.1 : 0.5),
                bgcolor: isExpanded 
                  ? alpha(theme.palette.primary.main, isDark ? 0.03 : 0.01)
                  : theme.palette.background.paper,
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                  transform: 'translateY(-2px)',
                  boxShadow: isDark 
                    ? `0 8px 24px ${alpha(theme.palette.common.black, 0.4)}`
                    : '0 4px 12px rgba(0,0,0,0.05)'
                }
              }}
            >
              <ListItem 
                sx={{ py: 2, px: 2.5, cursor: 'pointer' }}
                onClick={() => toggleExpand(p.id)}
              >
                <ListItemAvatar>
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={
                      p.is_chairperson ? (
                        <Box sx={{ 
                          bgcolor: 'background.paper', 
                          borderRadius: '50%', 
                          p: '2px', 
                          display: 'flex',
                          boxShadow: 1
                        }}>
                          <StarIcon sx={{ fontSize: 14, color: theme.palette.warning.main }} />
                        </Box>
                      ) : null
                    }
                  >
                    <Avatar 
                      sx={{ 
                        width: 52, height: 52,
                        background: p.is_chairperson 
                          ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                          : alpha(theme.palette.secondary.main, isDark ? 0.2 : 0.1),
                        color: p.is_chairperson ? '#fff' : theme.palette.secondary.main,
                        fontWeight: 800,
                        fontSize: '1.1rem',
                        border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`
                      }}
                    >
                      {p.name?.charAt(0).toUpperCase()}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>

                <ListItemText 
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                      <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                        {p.name}
                      </Typography>
                      {p.is_chairperson && (
                        <Chip 
                          label="Chair" size="small" 
                          sx={{ 
                            height: 18, fontSize: '0.65rem', fontWeight: 900,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main', border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                          }} 
                        />
                      )}
                      {p.attendance_status && (
                        <Chip 
                          label={p.attendance_status} 
                          size="small"
                          sx={{ 
                            height: 18, fontSize: '0.65rem', fontWeight: 800,
                            bgcolor: attStyle.bg, color: attStyle.main,
                            border: `1px solid ${attStyle.border}`,
                            textTransform: 'uppercase'
                          }}
                        />
                      )}
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      {p.organization || 'External Participant'} 
                      {p.email && ` • ${p.email}`}
                    </Typography>
                  }
                />

                <Stack direction="row" spacing={0.5} alignItems="center">
                  {isStarted && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Attended">
                        <IconButton 
                          color="success" size="small"
                          disabled={isUpdating}
                          onClick={(e) => { e.stopPropagation(); handleAttendance(p.id, 'attended'); }}
                          sx={{ bgcolor: alpha(theme.palette.success.main, 0.05) }}
                        >
                          <ConfirmIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Missed">
                        <IconButton 
                          color="error" size="small"
                          disabled={isUpdating}
                          onClick={(e) => { e.stopPropagation(); handleAttendance(p.id, 'missed'); }}
                          sx={{ bgcolor: alpha(theme.palette.error.main, 0.05) }}
                        >
                          <MissedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                  {isUpdating && <CircularProgress size={20} sx={{ mx: 1 }} />}
                  <IconButton 
                    size="small" 
                    sx={{ 
                      transition: '0.3s', 
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                      color: 'text.disabled'
                    }}
                  >
                    <ExpandMoreIcon />
                  </IconButton>
                </Stack>
              </ListItem>

              <Collapse in={isExpanded} timeout="auto">
                <Box sx={{ p: 3, bgcolor: alpha(theme.palette.action.hover, isDark ? 0.2 : 0.03) }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <LabelValue label="Position" value={p.title || 'N/A'} icon={<BusinessIcon fontSize="inherit"/>} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <LabelValue label="Contact" value={p.telephone || 'No phone'} icon={<PhoneIcon fontSize="inherit"/>} />
                    </Grid>
                    {p.notes && (
                      <Grid item xs={12}>
                        <LabelValue label="Notes" value={p.notes} />
                      </Grid>
                    )}
                  </Grid>
                  {renderAuditTrail(p)}
                </Box>
              </Collapse>
            </Paper>
          </Grow>
        );
      })}
    </List>
  );
};

const LabelValue = ({ label, value, icon }) => (
  <Box>
    <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
      {label}
    </Typography>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
      {icon && <Box sx={{ color: 'primary.main', display: 'flex', fontSize: 16 }}>{icon}</Box>}
      <Typography variant="body2" color="text.primary" fontWeight={500}>{value}</Typography>
    </Stack>
  </Box>
);

export default ParticipantList;