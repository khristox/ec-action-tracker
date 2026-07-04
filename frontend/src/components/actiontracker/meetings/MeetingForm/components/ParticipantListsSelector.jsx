// src/components/meetings/MeetingForm/components/ParticipantListsSelector.jsx
import React, { useState, useEffect } from 'react';
import { Stack, FormControl, InputLabel, Select, MenuItem, Paper, List, ListItem, ListItemAvatar, ListItemText, Avatar, Box, Typography, Button } from '@mui/material';
import { GroupAdd as GroupAdd } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchParticipantLists, selectParticipantLists } from '../../../../../store/slices/actionTracker/participantSlice';

export const ParticipantListsSelector = ({ onAddFromList, selectedParticipantIds }) => {
  const [selectedListId, setSelectedListId] = useState(null);
  
  const dispatch = useDispatch();
  const participantLists = useSelector(selectParticipantLists);
  
  useEffect(() => {
    dispatch(fetchParticipantLists());
  }, [dispatch]);
  
  const selectedList = participantLists.find(l => l.id === selectedListId);
  const availableParticipants = selectedList?.participants?.filter(p => !selectedParticipantIds.includes(p.id)) || [];
  
  const handleAddAll = () => {
    if (selectedList && availableParticipants.length > 0) {
      const participantsToAdd = availableParticipants.map(p => ({
        ...p,
        is_chairperson: false,
        from_list: true,
        list_id: selectedList.id
      }));
      onAddFromList(participantsToAdd);
    }
  };
  
  return (
    <Stack spacing={2}>
      <FormControl fullWidth size="small">
        <InputLabel>Select Participant List</InputLabel>
        <Select
          value={selectedListId || ''}
          onChange={(e) => setSelectedListId(e.target.value)}
          label="Select Participant List"
        >
          {participantLists.map(list => (
            <MenuItem key={list.id} value={list.id}>
              {list.name} ({list.participants?.length || 0} participants)
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {selectedList && (
        <>
          <Paper variant="outlined" sx={{ maxHeight: 250, overflow: 'auto' }}>
            <List dense>
              {availableParticipants.length === 0 ? (
                <ListItem>
                  <ListItemText primary="All participants from this list have been added" />
                </ListItem>
              ) : (
                availableParticipants.map(p => (
                  <ListItem key={p.id}>
                    <ListItemAvatar>
                      <Avatar>{p.name?.[0] || 'P'}</Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={p.name} secondary={p.email} />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
          <Button
            variant="contained"
            onClick={handleAddAll}
            disabled={availableParticipants.length === 0}
            startIcon={<GroupAdd />}
          >
            Add All ({availableParticipants.length}) Participants
          </Button>
        </>
      )}
    </Stack>
  );
};