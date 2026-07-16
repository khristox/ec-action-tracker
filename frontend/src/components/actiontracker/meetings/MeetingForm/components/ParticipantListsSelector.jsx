// src/components/meetings/MeetingForm/components/ParticipantListsSelector.jsx
import React, { useState, useEffect } from 'react';
import { Stack, FormControl, InputLabel, Select, MenuItem, Paper, List, ListItem, ListItemAvatar, ListItemText, ListItemButton, Checkbox, Avatar, Box, Typography, Button } from '@mui/material';
import { GroupAdd as GroupAdd } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchParticipantLists, selectParticipantLists } from '../../../../../store/slices/actionTracker/participantSlice';

export const ParticipantListsSelector = ({ onAddFromList, selectedParticipantIds }) => {
  const [selectedListId, setSelectedListId] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);

  const dispatch = useDispatch();
  const participantLists = useSelector(selectParticipantLists);

  useEffect(() => {
    dispatch(fetchParticipantLists());
  }, [dispatch]);

  const selectedList = participantLists.find(l => l.id === selectedListId);
  const availableParticipants = selectedList?.participants?.filter(p => !selectedParticipantIds.includes(p.id)) || [];

  // Reset checked selections whenever the chosen list changes
  useEffect(() => {
    setCheckedIds([]);
  }, [selectedListId]);

  const allChecked = availableParticipants.length > 0 && checkedIds.length === availableParticipants.length;
  const someChecked = checkedIds.length > 0 && !allChecked;

  const handleToggleOne = (id) => {
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    if (allChecked) {
      setCheckedIds([]);
    } else {
      setCheckedIds(availableParticipants.map(p => p.id));
    }
  };

  const handleAddSelected = () => {
    if (!selectedList || checkedIds.length === 0) return;
    const participantsToAdd = availableParticipants
      .filter(p => checkedIds.includes(p.id))
      .map(p => ({
        ...p,
        is_chairperson: false,
        from_list: true,
        list_id: selectedList.id
      }));
    onAddFromList(participantsToAdd);
    setCheckedIds([]);
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
                <>
                  <ListItem disablePadding divider>
                    <ListItemButton onClick={handleToggleAll} dense>
                      <Checkbox
                        edge="start"
                        checked={allChecked}
                        indeterminate={someChecked}
                        tabIndex={-1}
                        disableRipple
                      />
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>Select All</Typography>}
                      />
                    </ListItemButton>
                  </ListItem>
                  {availableParticipants.map(p => (
                    <ListItem key={p.id} disablePadding>
                      <ListItemButton onClick={() => handleToggleOne(p.id)} dense>
                        <Checkbox
                          edge="start"
                          checked={checkedIds.includes(p.id)}
                          tabIndex={-1}
                          disableRipple
                        />
                        <ListItemAvatar>
                          <Avatar>{p.name?.[0] || 'P'}</Avatar>
                        </ListItemAvatar>
                        <ListItemText primary={p.name} secondary={p.email} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </>
              )}
            </List>
          </Paper>
          <Button
            variant="contained"
            onClick={handleAddSelected}
            disabled={checkedIds.length === 0}
            startIcon={<GroupAdd />}
          >
            Add Selected ({checkedIds.length}) Participant{checkedIds.length === 1 ? '' : 's'}
          </Button>
        </>
      )}
    </Stack>
  );
};