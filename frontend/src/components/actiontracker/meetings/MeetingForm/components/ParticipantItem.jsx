// src/components/meetings/MeetingForm/components/ParticipantItem.jsx
import React from 'react';
import { ListItem, ListItemAvatar, ListItemText, Avatar, Stack, Typography, Chip, IconButton, Tooltip, Button } from '@mui/material';
import { Delete as Delete, Email as EmailIcon, Phone as PhoneIcon, Title as TitleIcon, Work as WorkIcon } from '@mui/icons-material';

export const ParticipantItem = React.memo(({ 
  participant, 
  onRemove, 
  onMakeChairperson, 
  isChairperson, 
  isSecretary, 
  showActions = true 
}) => (
  <ListItem
    secondaryAction={showActions && (
      <Tooltip title="Remove participant">
        <IconButton edge="end" onClick={() => onRemove(participant.id)}>
          <Delete />
        </IconButton>
      </Tooltip>
    )}
  >
    <ListItemAvatar>
      <Avatar sx={{ bgcolor: isChairperson ? 'primary.main' : 'success.main' }}>
        {participant.name?.charAt(0) || 'P'}
      </Avatar>
    </ListItemAvatar>
    <ListItemText
      primary={
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <Typography variant="body2" fontWeight={500}>{participant.name}</Typography>
          {isChairperson && <Chip label="Chairperson" size="small" color="primary" />}
          {isSecretary && <Chip label="Secretary" size="small" color="secondary" />}
          {participant.is_existing && <Chip label="Existing User" size="small" variant="outlined" />}
          {participant.is_manual && <Chip label="Manual" size="small" variant="outlined" />}
        </Stack>
      }
      secondary={
        <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
          {participant.email && (
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <EmailIcon sx={{ fontSize: 12 }} /> {participant.email}
            </Typography>
          )}
          {participant.telephone && (
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PhoneIcon sx={{ fontSize: 12 }} /> {participant.telephone}
            </Typography>
          )}
          {participant.title && (
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TitleIcon sx={{ fontSize: 12 }} /> {participant.title}
            </Typography>
          )}
          {participant.organization && (
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WorkIcon sx={{ fontSize: 12 }} /> {participant.organization}
            </Typography>
          )}
        </Stack>
      }
    />
    {!isChairperson && showActions && (
      <Button size="small" onClick={() => onMakeChairperson(participant.id)}>
        Make Chairperson
      </Button>
    )}
  </ListItem>
));